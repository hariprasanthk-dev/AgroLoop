import mongoose, { Types } from "mongoose";
import Order, { OrderDocument } from "../models/Order.model";
import InventoryBatch from "../models/InventoryBatch.model";
import { ApiError } from "../utils/ApiError";
import {
  OrderStatus,
  PaginationMeta,
  UserRole,
  LEGACY_PACKAGED_STATUS,
} from "../types";
import { getIO } from "../socket/socket";
import { logger } from "../config/logger";
import {
  notify,
  emitOrderUpdated,
  formatOrderRef,
} from "./notification.service";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CreateOrderPayload {
  clientId: string;
  inventoryBatchId: string;
  quantityKg: number;
  destination: string;
  notes?: string;
}

interface ListOrdersQuery {
  page?: number;
  limit?: number;
  orderStatus?: OrderStatus;
  clientId?: string;
  farmerId?: string;
}

interface OrderListResult {
  orders: OrderDocument[];
  pagination: PaginationMeta;
}

export interface Actor {
  id: string;
  role: UserRole;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Emit inventory refresh to all connected clients — never throws. */
const emitInventoryRefresh = (): void => {
  try {
    getIO().to("broadcast:inventory").emit("inventory:refresh", { timestamp: Date.now() });
  } catch {
    // Socket.IO not initialised (tests/scripts) — not critical.
  }
};

/** Documents written by older versions may still hold "packed". */
const normalizeStatus = (status: string): OrderStatus =>
  (status === LEGACY_PACKAGED_STATUS ? "packaged" : status) as OrderStatus;

/** Stored values that represent a given logical status. */
const storedValuesFor = (status: OrderStatus): string[] =>
  status === "packaged" ? ["packaged", LEGACY_PACKAGED_STATUS] : [status];

const ORDER_POPULATE = [
  { path: "clientId", select: "name email" },
  { path: "inventoryBatchId", select: "category quantityKg pricePerKg location farmerId" },
];

/** Resolves the farmer who owns the batch an order was placed against. */
const getOrderFarmerId = async (
  inventoryBatchId: Types.ObjectId
): Promise<string | null> => {
  const batch = await InventoryBatch.findById(inventoryBatchId).select("farmerId").lean();
  return batch ? batch.farmerId.toString() : null;
};

/**
 * Throws unless the actor may see the order: the owning client, the farmer
 * who owns the batch, or an admin. Shared by order and payment endpoints.
 */
export const assertOrderAccess = async (
  order: { clientId: Types.ObjectId | { _id: Types.ObjectId }; inventoryBatchId: Types.ObjectId | { _id: Types.ObjectId } },
  actor: Actor
): Promise<void> => {
  if (actor.role === "admin") return;

  const idOf = (v: Types.ObjectId | { _id: Types.ObjectId }) =>
    ("_id" in v ? v._id : v).toString();

  if (actor.role === "client") {
    if (idOf(order.clientId) !== actor.id) throw ApiError.forbidden("Access denied");
    return;
  }

  const farmerId = await getOrderFarmerId(
    new Types.ObjectId(idOf(order.inventoryBatchId))
  );
  if (farmerId !== actor.id) throw ApiError.forbidden("Access denied");
};

/**
 * Atomically returns stock to a batch. A single pipeline update adds the
 * quantity back and re-opens the batch if it had been marked reserved/sold,
 * so there is no read-modify-write window for concurrent orders to race.
 */
const restoreStock = async (batchId: Types.ObjectId, quantityKg: number): Promise<void> => {
  await InventoryBatch.updateOne(
    { _id: batchId },
    [
      { $set: { quantityKg: { $add: ["$quantityKg", quantityKg] } } },
      {
        $set: {
          status: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["reserved", "sold"]] },
                  { $gt: ["$quantityKg", 0] },
                ],
              },
              "available",
              "$status",
            ],
          },
        },
      },
    ],
    { updatePipeline: true }
  );
};

// ─── Order state machine ──────────────────────────────────────────────────────

interface TransitionRule {
  /** Statuses the order may currently be in. */
  from: OrderStatus[];
  /** Roles allowed to perform the transition. */
  roles: UserRole[];
  /** Fulfilment steps are only allowed once the payment is verified. */
  requiresPaid: boolean;
}

/**
 * The only order status transitions the API accepts. Anything not listed
 * here (e.g. PENDING → PACKAGED, DELIVERED → anything) is rejected.
 *
 *   PENDING → ACCEPTED → PACKAGED → SHIPPED → DELIVERED
 *   PENDING | ACCEPTED | PACKAGED | SHIPPED → CANCELLED
 *
 * Payment status is tracked separately; it is never derived from, nor does
 * it drive, the order status.
 */
const TRANSITIONS: Partial<Record<OrderStatus, TransitionRule>> = {
  accepted:  { from: ["pending"],  roles: ["farmer"], requiresPaid: true },
  packaged:  { from: ["accepted"], roles: ["farmer"], requiresPaid: true },
  shipped:   { from: ["packaged"], roles: ["farmer"], requiresPaid: true },
  delivered: { from: ["shipped"],  roles: ["farmer"], requiresPaid: true },
  cancelled: {
    from: ["pending", "accepted", "packaged", "shipped"],
    roles: ["client", "farmer", "admin"],
    requiresPaid: false,
  },
};

/** Once goods have left the farm, cancelling must not put them back in stock. */
const STOCK_RESTORED_ON_CANCEL_FROM: OrderStatus[] = ["pending", "accepted", "packaged"];

const CLIENT_MESSAGES: Partial<Record<OrderStatus, (ref: string) => { title: string; message: string }>> = {
  accepted:  (ref) => ({ title: "Order Accepted",  message: `Your order ${ref} has been accepted by the farmer.` }),
  packaged:  (ref) => ({ title: "Order Packaged",  message: `Your order ${ref} has been packaged.` }),
  shipped:   (ref) => ({ title: "Order Shipped",   message: `Your order ${ref} has been shipped.` }),
  delivered: (ref) => ({ title: "Order Delivered", message: `Your order ${ref} has been delivered.` }),
};

interface TransitionOptions {
  /** Further restricts the allowed source statuses (e.g. "reject" = pending only). */
  onlyFrom?: OrderStatus[];
}

/**
 * The single, controlled way to change an order's status.
 *
 * 1. Authorises the actor against the order (owner client / owning farmer / admin).
 * 2. Validates the transition against TRANSITIONS — the requested target is
 *    never trusted on its own.
 * 3. Applies it with a conditional findOneAndUpdate on the *current* status
 *    (and payment status where required). Two concurrent requests cannot both
 *    succeed, so side effects such as restoring stock run at most once.
 * 4. Performs inventory side effects, persists notifications and emits
 *    `order:updated` so both parties re-fetch from the API.
 */
export const transitionOrder = async (
  orderId: string,
  actor: Actor,
  to: OrderStatus,
  options: TransitionOptions = {}
): Promise<OrderDocument> => {
  if (!mongoose.isValidObjectId(orderId)) throw ApiError.badRequest("Invalid order ID");

  const rule = TRANSITIONS[to];
  if (!rule) throw ApiError.badRequest(`'${to}' is not a status an order can be moved to`);

  const order = await Order.findById(orderId).lean();
  if (!order) throw ApiError.notFound("Order not found");

  if (!rule.roles.includes(actor.role)) {
    throw ApiError.forbidden(`A ${actor.role} cannot move an order to '${to}'`);
  }
  await assertOrderAccess(order, actor);

  const current = normalizeStatus(order.orderStatus);
  const allowedFrom = options.onlyFrom
    ? rule.from.filter((s) => options.onlyFrom!.includes(s))
    : actor.role === "client"
      ? ["pending" as OrderStatus] // clients may only cancel before the farmer accepts
      : rule.from;

  if (!allowedFrom.includes(current)) {
    throw ApiError.badRequest(`Cannot move order from '${current}' to '${to}'`);
  }

  if (rule.requiresPaid && order.paymentStatus !== "paid") {
    throw ApiError.badRequest(
      `Payment has not been received for this order (payment status: '${order.paymentStatus}'). ` +
        `It cannot be moved to '${to}' until the payment is verified.`
    );
  }

  // Refunds are not automated. Don't let a client create a refund obligation
  // on their own — a paid order has to be cancelled by the farmer or an admin.
  if (to === "cancelled" && actor.role === "client" && order.paymentStatus === "paid") {
    throw ApiError.badRequest(
      "This order has already been paid. Please contact the farmer to cancel it and arrange a refund."
    );
  }

  // Conditional on the status we validated against: if anything changed in
  // between, the update matches nothing and we report a conflict.
  const guard: Record<string, unknown> = {
    _id: order._id,
    orderStatus: { $in: storedValuesFor(current) },
  };
  if (rule.requiresPaid) guard.paymentStatus = "paid";

  const updated = await Order.findOneAndUpdate(
    guard,
    {
      $set: {
        orderStatus: to,
        ...(to === "cancelled" && { cancelledBy: actor.role }),
      },
      $push: { statusHistory: { status: to, at: new Date(), by: actor.role } },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    throw ApiError.conflict(
      "This order was changed by another request. Refresh and try again."
    );
  }

  // ── Inventory side effects ────────────────────────────────────────────────
  let stockRestored = false;
  if (to === "cancelled" && STOCK_RESTORED_ON_CANCEL_FROM.includes(current)) {
    try {
      await restoreStock(order.inventoryBatchId, order.quantityKg);
      stockRestored = true;
    } catch (err) {
      // The order is already cancelled; surface the inconsistency loudly.
      logger.error(
        { err, orderId, batchId: order.inventoryBatchId, quantityKg: order.quantityKg },
        "Order cancelled but restoring stock failed — manual correction required"
      );
    }
  }

  if (to === "delivered") {
    // A fully drained batch whose last delivery completes becomes "sold".
    await InventoryBatch.updateOne(
      { _id: order.inventoryBatchId, status: "reserved", quantityKg: { $lte: 0 } },
      { $set: { status: "sold" } }
    );
  }

  // ── Notifications ────────────────────────────────────────────────────────
  const ref = formatOrderRef(order._id);
  const clientId = order.clientId.toString();
  const farmerId = await getOrderFarmerId(order.inventoryBatchId);
  const relatedId = order._id;

  if (to === "cancelled") {
    const refundNote =
      order.paymentStatus === "paid"
        ? " Your payment was received; refunds are not automatic — please contact the farmer to arrange one."
        : "";

    if (actor.role !== "client") {
      await notify(clientId, {
        type: current === "pending" ? "order_rejected" : "order_cancelled",
        title: current === "pending" ? "Order Rejected" : "Order Cancelled",
        message: `Your order ${ref} was ${current === "pending" ? "rejected" : "cancelled"} by the ${actor.role}.${refundNote}`,
        relatedId,
      });
    }
    if (actor.role !== "farmer" && farmerId) {
      await notify(farmerId, {
        type: "order_cancelled",
        title: "Order Cancelled",
        message: `Order ${ref} was cancelled by the ${actor.role}.`,
        relatedId,
      });
    }
  } else {
    const content = CLIENT_MESSAGES[to];
    if (content) {
      await notify(clientId, { type: `order_${to}` as never, ...content(ref), relatedId });
    }
  }

  emitOrderUpdated(order._id, farmerId ? [clientId, farmerId] : [clientId]);
  if (stockRestored) emitInventoryRefresh();

  return updated.populate(ORDER_POPULATE);
};

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Client places a new order.
 * - Atomically reserves stock using findOneAndUpdate (prevents overselling)
 * - Creates the order with orderStatus = pending, paymentStatus = pending
 * - Compensates by restoring stock if Order.create() fails
 * - Notifies the farmer that a new order is waiting for payment
 */
export const createOrder = async (
  payload: CreateOrderPayload
): Promise<OrderDocument> => {
  const { clientId, inventoryBatchId, quantityKg, destination, notes } = payload;

  // ── Step 1: Atomically reserve stock ─────────────────────────────────────────
  // The filter and the decrement are evaluated as one server-side operation,
  // so two concurrent requests can never both take the last units of stock.
  const updatedBatch = await InventoryBatch.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(inventoryBatchId),
      status: "available",
      quantityKg: { $gte: quantityKg },
    },
    { $inc: { quantityKg: -quantityKg } },
    { returnDocument: "after", runValidators: false }
  );

  if (!updatedBatch) {
    // No stock was modified — read the batch only to report the precise reason.
    const existingBatch = await InventoryBatch.findById(inventoryBatchId).lean();
    if (!existingBatch) throw ApiError.notFound("Inventory batch not found");
    if (existingBatch.status !== "available")
      throw ApiError.badRequest("This batch is not available for ordering");
    throw ApiError.badRequest(
      `Only ${existingBatch.quantityKg} kg available in this batch`
    );
  }

  // ── Step 1b: Mark batch as "reserved" once its stock is fully taken ─────────
  let stockDepleted = false;
  if (updatedBatch.quantityKg <= 0) {
    stockDepleted = true;
    await InventoryBatch.updateOne(
      { _id: updatedBatch._id, quantityKg: { $lte: 0 } },
      { $set: { quantityKg: 0, status: "reserved" } }
    );
  }

  const totalAmount = quantityKg * updatedBatch.pricePerKg;

  // ── Step 2: Create the order document ────────────────────────────────────────
  let order: OrderDocument;
  try {
    order = await Order.create({
      clientId,
      inventoryBatchId,
      quantityKg,
      totalAmount,
      destination,
      notes,
      orderStatus: "pending",
      paymentStatus: "pending",
      statusHistory: [{ status: "pending", at: new Date(), by: "client" }],
    });
  } catch (err) {
    logger.error({ err, inventoryBatchId, quantityKg }, "Order creation failed — restoring stock");
    await restoreStock(updatedBatch._id, quantityKg);
    throw ApiError.internal(
      "Order creation failed due to a server error. Please try again."
    );
  }

  const farmerId = updatedBatch.farmerId.toString();
  await notify(farmerId, {
    type: "order_placed",
    title: "New Order",
    message: `New order ${formatOrderRef(order._id)} is waiting for payment (${quantityKg} kg of ${updatedBatch.category}).`,
    relatedId: order._id,
  });
  emitOrderUpdated(order._id, [farmerId]);

  // Stock levels changed for everyone browsing inventory.
  emitInventoryRefresh();
  if (stockDepleted) logger.info({ batchId: updatedBatch._id }, "Batch fully reserved");

  return order.populate(ORDER_POPULATE);
};

/** Client cancels their own PENDING, unpaid order. Stock is restored. */
export const cancelOrder = (orderId: string, clientId: string) =>
  transitionOrder(orderId, { id: clientId, role: "client" }, "cancelled");

/** Farmer accepts a PENDING order. Requires the payment to be verified. */
export const acceptOrder = (orderId: string, farmerId: string) =>
  transitionOrder(orderId, { id: farmerId, role: "farmer" }, "accepted");

/** Farmer rejects a PENDING order. Stock is restored. */
export const rejectOrder = (orderId: string, farmerId: string) =>
  transitionOrder(orderId, { id: farmerId, role: "farmer" }, "cancelled", {
    onlyFrom: ["pending"],
  });

/**
 * Farmer (or admin, for cancellation) moves an order along its lifecycle.
 * Validation is entirely server-side — see TRANSITIONS.
 */
export const updateOrderStatus = (orderId: string, actor: Actor, newStatus: OrderStatus) =>
  transitionOrder(orderId, actor, newStatus);

/**
 * List orders — scoped by role:
 *  - client   → their own orders
 *  - farmer   → orders on their batches
 *  - admin    → all orders (optional clientId filter)
 */
export const listOrders = async (
  query: ListOrdersQuery
): Promise<OrderListResult> => {
  const { page = 1, limit = 20, orderStatus, clientId, farmerId } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};
  if (orderStatus) filter.orderStatus = { $in: storedValuesFor(normalizeStatus(orderStatus)) };
  if (clientId) filter.clientId = new mongoose.Types.ObjectId(clientId);

  // Farmer-scoped: only orders whose batch belongs to this farmer
  if (farmerId && !clientId) {
    const farmerBatchIds = await InventoryBatch.find(
      { farmerId: new mongoose.Types.ObjectId(farmerId) },
      "_id"
    ).lean();

    if (farmerBatchIds.length === 0) {
      return {
        orders: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }

    filter.inventoryBatchId = { $in: farmerBatchIds.map((b) => b._id) };
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const getOrderById = async (
  orderId: string,
  requesterId: string,
  requesterRole: UserRole
): Promise<OrderDocument> => {
  if (!mongoose.isValidObjectId(orderId)) throw ApiError.badRequest("Invalid order ID");

  const order = await Order.findById(orderId).populate(ORDER_POPULATE);
  if (!order) throw ApiError.notFound("Order not found");

  await assertOrderAccess(order, { id: requesterId, role: requesterRole });
  return order;
};

export const getOrderStats = async () => {
  return Order.aggregate([
    {
      $group: {
        _id: {
          $cond: [{ $eq: ["$orderStatus", LEGACY_PACKAGED_STATUS] }, "packaged", "$orderStatus"],
        },
        count: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);
};
