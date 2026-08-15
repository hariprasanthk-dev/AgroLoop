import mongoose from "mongoose";
import Order, { OrderDocument } from "../models/Order.model";
import InventoryBatch from "../models/InventoryBatch.model";
import Notification from "../models/Notification.model";
import { ApiError } from "../utils/ApiError";
import { OrderStatus, PaginationMeta } from "../types";
import { getIO } from "../socket/socket";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely emit a socket event — never throws */
const emit = (room: string, event: string, payload: unknown): void => {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // Socket.IO not critical
  }
};

/** Emit inventory refresh to all connected clients */
const emitInventoryRefresh = (): void => {
  emit("broadcast:inventory", "inventory:refresh", { timestamp: Date.now() });
};

// ─── Status transition map (farmer-allowed progressions) ──────────────────────
const FARMER_STATUS_PROGRESSION: Record<string, OrderStatus> = {
  accepted: "packed",
  packed: "shipped",
  shipped: "delivered",
};

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Client places a new order.
 * - Atomically reserves stock using findOneAndUpdate (prevents race conditions)
 * - Creates the order document after stock is successfully reserved
 * - Compensates by restoring stock if Order.create() fails
 * - Notifies farmer via socket + DB notification
 */
export const createOrder = async (
  payload: CreateOrderPayload
): Promise<OrderDocument> => {
  const { clientId, inventoryBatchId, quantityKg, destination, notes } = payload;

  // ── Step 1: Atomically reserve stock ─────────────────────────────────────────
  // A single findOneAndUpdate that checks conditions AND decrements stock in
  // one server-side operation. MongoDB guarantees no two concurrent requests
  // can both satisfy the filter when stock is insufficient for both.
  //
  // Filter conditions (all enforced atomically by MongoDB):
  //   • _id matches the requested batch
  //   • status === "available"
  //   • quantityKg >= requested quantity  ← this is the race-condition guard
  //
  // $inc ensures the decrement is atomic; it never sets quantity below 0
  // because the filter rejects any document where quantityKg < requested.
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
    // The atomic update found no matching document. Determine the precise reason
    // by reading the original batch (a non-critical diagnostic read — no stock
    // has been modified at this point).
    const existingBatch = await InventoryBatch.findById(inventoryBatchId).lean();
    if (!existingBatch) throw ApiError.notFound("Inventory batch not found");
    if (existingBatch.status !== "available")
      throw ApiError.badRequest("This batch is not available for ordering");
    throw ApiError.badRequest(
      `Only ${existingBatch.quantityKg} kg available in this batch`
    );
  }

  // ── Step 1b: Mark batch as "reserved" if stock just hit zero ─────────────────
  // This second update is idempotent and purely cosmetic for business logic.
  // Race-condition safety is already guaranteed by the $gte filter above —
  // no further orders can pass through regardless of status, because 0 >= 1 fails.
  let stockDepleted = false;
  if (updatedBatch.quantityKg <= 0) {
    stockDepleted = true;
    updatedBatch.quantityKg = 0; // safety floor on the local document
    await InventoryBatch.findOneAndUpdate(
      { _id: updatedBatch._id },
      { $set: { quantityKg: 0, status: "reserved" } },
      { runValidators: false }
    );
    updatedBatch.status = "reserved";
  }

  const totalAmount = quantityKg * updatedBatch.pricePerKg;

  // ── Step 2: Create the order document ────────────────────────────────────────
  // Stock is already atomically reserved above. If Order.create() fails for any
  // reason (validation error, DB outage, etc.), we compensate by restoring the
  // decremented stock so inventory remains consistent.
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
    });
  } catch (err) {
    // Compensating update: restore the quantity that was just decremented.
    // Also restore status back to "available" if the batch was marked reserved
    // due to this order draining the stock.
    await InventoryBatch.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(inventoryBatchId) },
      {
        $inc: { quantityKg: quantityKg },
        ...(stockDepleted && { $set: { status: "available" } }),
      },
      { runValidators: false }
    );
    throw ApiError.internal(
      "Order creation failed due to a server error. Please try again."
    );
  }

  // ── Notify farmer ────────────────────────────────────────────────────────────
  const farmerRoom = `user:${updatedBatch.farmerId.toString()}`;
  emit(farmerRoom, "notification:new", {
    title: "🛒 New Order Received",
    message: `Order #${String(order._id).slice(-6)} — ${quantityKg} kg of ${updatedBatch.category} onions`,
    type: "order_placed",
    orderId: order._id,
  });

  await Notification.create({
    userId: updatedBatch.farmerId,
    title: "New Order Received",
    message: `A client placed an order for ${quantityKg} kg of your ${updatedBatch.category} onions.`,
    type: "order_placed",
    relatedId: order._id,
  });

  // ── Notify all clients that inventory changed ────────────────────────────────
  emitInventoryRefresh();

  return order.populate([
    { path: "clientId", select: "name email" },
    { path: "inventoryBatchId", select: "category quantityKg pricePerKg location farmerId" },
  ]);
};

/**
 * Client cancels a PENDING order.
 * - Restores stock to the batch
 * - Emits inventory refresh
 */
export const cancelOrder = async (
  orderId: string,
  clientId: string
): Promise<OrderDocument> => {
  const order = await Order.findById(orderId).populate("inventoryBatchId");
  if (!order) throw ApiError.notFound("Order not found");

  // Only the owner client can cancel
  if (order.clientId.toString() !== clientId)
    throw ApiError.forbidden("You can only cancel your own orders");

  // Can only cancel if still pending
  if (order.orderStatus !== "pending")
    throw ApiError.badRequest(
      `Cannot cancel an order that is already '${order.orderStatus}'. Contact the farmer.`
    );

  order.orderStatus = "cancelled";
  await order.save();

  // Restore stock
  const batch = await InventoryBatch.findById(order.inventoryBatchId);
  if (batch) {
    batch.quantityKg += order.quantityKg;
    // Restore to 'available' whenever stock exists — covers both the normal
    // case (was 'reserved') and the edge case where Bug #1 had erroneously
    // marked the batch as 'sold' before the fix.
    if (batch.quantityKg > 0 && batch.status !== "expired") {
      batch.status = "available";
    }
    await batch.save();
  }

  // Notify farmer
  if (batch) {
    emit(`user:${batch.farmerId.toString()}`, "notification:new", {
      title: "Order Cancelled",
      message: `Order #${orderId.slice(-6)} was cancelled by the client.`,
      type: "order_cancelled",
    });
    await Notification.create({
      userId: batch.farmerId,
      title: "Order Cancelled",
      message: `The client cancelled order #${orderId.slice(-6)} for ${order.quantityKg} kg.`,
      type: "order_cancelled",
      relatedId: order._id,
    });
  }

  emitInventoryRefresh();

  return order;
};

/**
 * Farmer accepts a pending order.
 * - Verifies the batch belongs to this farmer
 * - Sets status to 'accepted'
 * - Notifies client
 */
export const acceptOrder = async (
  orderId: string,
  farmerId: string
): Promise<OrderDocument> => {
  const order = await Order.findById(orderId).populate("inventoryBatchId");
  if (!order) throw ApiError.notFound("Order not found");

  // Verify the batch belongs to this farmer
  const batch = await InventoryBatch.findById(order.inventoryBatchId);
  if (!batch) throw ApiError.notFound("Inventory batch not found");
  if (batch.farmerId.toString() !== farmerId)
    throw ApiError.forbidden("This order is not for your inventory");

  if (order.orderStatus !== "pending")
    throw ApiError.badRequest(
      `Cannot accept an order in '${order.orderStatus}' status`
    );

  order.orderStatus = "accepted";
  await order.save();

  // Notify client
  const clientRoom = `user:${order.clientId.toString()}`;
  emit(clientRoom, "order:statusUpdate", {
    orderId: order._id,
    previousStatus: "pending",
    newStatus: "accepted",
    message: "Your order has been accepted by the farmer!",
  });

  await Notification.create({
    userId: order.clientId,
    title: "Order Accepted ✅",
    message: "The farmer has accepted your order. It will be packed soon.",
    type: "order_accepted",
    relatedId: order._id,
  });

  return order.populate([
    { path: "clientId", select: "name email" },
    { path: "inventoryBatchId", select: "category quantityKg pricePerKg location" },
  ]);
};

/**
 * Farmer rejects a pending order.
 * - Restores stock
 * - Sets status to 'cancelled'
 * - Notifies client
 */
export const rejectOrder = async (
  orderId: string,
  farmerId: string
): Promise<OrderDocument> => {
  const order = await Order.findById(orderId).populate("inventoryBatchId");
  if (!order) throw ApiError.notFound("Order not found");

  const batch = await InventoryBatch.findById(order.inventoryBatchId);
  if (!batch) throw ApiError.notFound("Inventory batch not found");
  if (batch.farmerId.toString() !== farmerId)
    throw ApiError.forbidden("This order is not for your inventory");

  if (order.orderStatus !== "pending")
    throw ApiError.badRequest(
      `Cannot reject an order in '${order.orderStatus}' status`
    );

  order.orderStatus = "cancelled";
  await order.save();

  // Restore stock
  batch.quantityKg += order.quantityKg;
  // Restore to 'available' whenever stock exists — covers both the normal
  // case (was 'reserved') and any edge case where the batch was incorrectly
  // marked 'sold' despite having remaining stock.
  if (batch.quantityKg > 0 && batch.status !== "expired") {
    batch.status = "available";
  }
  await batch.save();

  // Notify client
  const clientRoom = `user:${order.clientId.toString()}`;
  emit(clientRoom, "order:statusUpdate", {
    orderId: order._id,
    previousStatus: "pending",
    newStatus: "cancelled",
    message: "Your order has been rejected by the farmer.",
  });

  await Notification.create({
    userId: order.clientId,
    title: "Order Rejected",
    message: "Unfortunately the farmer rejected your order. Your stock has been restored.",
    type: "order_rejected",
    relatedId: order._id,
  });

  emitInventoryRefresh();

  return order;
};

/**
 * Farmer advances order status: accepted → packed → shipped → delivered
 */
export const updateOrderStatus = async (
  orderId: string,
  farmerId: string,
  newStatus: OrderStatus
): Promise<OrderDocument> => {
  const order = await Order.findById(orderId).populate("inventoryBatchId");
  if (!order) throw ApiError.notFound("Order not found");

  const batch = await InventoryBatch.findById(order.inventoryBatchId);
  if (!batch) throw ApiError.notFound("Inventory batch not found");
  if (batch.farmerId.toString() !== farmerId)
    throw ApiError.forbidden("This order is not for your inventory");

  // Validate status progression
  const expectedNext = FARMER_STATUS_PROGRESSION[order.orderStatus];
  if (expectedNext !== newStatus) {
    throw ApiError.badRequest(
      `Cannot move order from '${order.orderStatus}' to '${newStatus}'. ` +
        (expectedNext
          ? `Next valid status is '${expectedNext}'.`
          : "Order has reached its final status.")
    );
  }

  const previousStatus = order.orderStatus;
  order.orderStatus = newStatus;

  // Update batch status when the order reaches "delivered".
  // IMPORTANT: Only mark the batch as "sold" when ALL stock is exhausted.
  // Partial orders (e.g. 300 kg sold from a 500 kg batch) leave the batch
  // with remaining stock — it must stay "available" for future orders.
  if (newStatus === "delivered") {
    if (batch.quantityKg <= 0) {
      batch.status = "sold";
    } else {
      // Remaining stock exists — keep it available.
      // (also corrects any batch that was wrongly set to "reserved" when
      //  stock hit zero due to this order but was later partially cancelled)
      batch.status = "available";
    }
    await batch.save();
  }

  await order.save();

  // Notify client
  const notifMessages: Partial<Record<OrderStatus, string>> = {
    packed: "Your order has been packed and is ready for shipment.",
    shipped: "Your order is on its way! 🚚",
    delivered: "Your order has been delivered. Thank you! 🎉",
  };

  const clientRoom = `user:${order.clientId.toString()}`;
  emit(clientRoom, "order:statusUpdate", {
    orderId: order._id,
    previousStatus,
    newStatus,
    message: notifMessages[newStatus] ?? `Order status updated to ${newStatus}`,
  });

  if (notifMessages[newStatus]) {
    await Notification.create({
      userId: order.clientId,
      title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      message: notifMessages[newStatus]!,
      type: `order_${newStatus}` as never,
      relatedId: order._id,
    });
  }

  return order.populate([
    { path: "clientId", select: "name email" },
    { path: "inventoryBatchId", select: "category quantityKg pricePerKg location" },
  ]);
};

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
  if (orderStatus) filter.orderStatus = orderStatus;
  if (clientId) filter.clientId = new mongoose.Types.ObjectId(clientId);

  // Farmer-scoped: only orders whose batch belongs to this farmer
  if (farmerId && !clientId) {
    const farmerBatchIds = await InventoryBatch.find(
      { farmerId: new mongoose.Types.ObjectId(farmerId) },
      "_id"
    ).lean();

    // If the farmer has no batches at all, return early — no orders possible.
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
      .populate("clientId", "name email")
      .populate("inventoryBatchId", "category quantityKg pricePerKg farmerId location")
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
  requesterRole: string
): Promise<OrderDocument> => {
  const order = await Order.findById(orderId)
    .populate("clientId", "name email")
    .populate("inventoryBatchId", "category quantityKg pricePerKg farmerId location");

  if (!order) throw ApiError.notFound("Order not found");

  if (requesterRole === "client" && order.clientId._id.toString() !== requesterId)
    throw ApiError.forbidden("Access denied");

  if (requesterRole === "farmer") {
    const batch = await InventoryBatch.findById(order.inventoryBatchId);
    if (!batch || batch.farmerId.toString() !== requesterId)
      throw ApiError.forbidden("Access denied");
  }

  return order;
};

export const getOrderStats = async () => {
  return Order.aggregate([
    {
      $group: {
        _id: "$orderStatus",
        count: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);
};
