/**
 * Integration tests for the order + payment workflow.
 *
 * Runs the real Express app, routes, middleware, services and Socket.IO
 * against a throwaway MongoDB (mongodb-memory-server). Only Razorpay's
 * outbound `orders.create` API call is mocked; checkout signatures are
 * computed with the test secret and verified by the real code.
 */
import http from "http";
import crypto from "crypto";
import { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as ioClient, Socket } from "socket.io-client";

let rzpCounter = 0;
vi.mock("razorpay", () => ({
  default: class RazorpayMock {
    orders = {
      create: async (opts: { amount: number; currency: string }) => ({
        id: `order_test${++rzpCounter}`,
        amount: opts.amount,
        currency: opts.currency,
      }),
    };
  },
}));

import app from "../app";
import { initSocket } from "../socket/socket";
import User from "../models/User.model";
import InventoryBatch from "../models/InventoryBatch.model";
import Order from "../models/Order.model";
import Payment from "../models/Payment.model";
import Notification from "../models/Notification.model";

// ─── Harness ──────────────────────────────────────────────────────────────────

let mongo: MongoMemoryServer;
let server: http.Server;
let baseUrl: string;

type Role = "farmer" | "client" | "admin";
interface TestUser { id: string; token: string }
const users: Record<"farmer" | "client" | "client2" | "farmer2" | "admin", TestUser> = {} as never;

const makeUser = async (key: keyof typeof users, role: Role) => {
  const user = await User.create({
    name: `${key} user`,
    email: `${key}@test.dev`,
    password: "password123",
    role,
  });
  const token = jwt.sign({ id: user._id.toString(), role, email: user.email }, process.env.JWT_SECRET!);
  users[key] = { id: user._id.toString(), token };
};

const api = async (
  method: string,
  path: string,
  token?: string,
  body?: unknown,
  headers: Record<string, string> = {}
) => {
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const json = (await res.json()) as { success: boolean; message: string; data?: any };
  return { status: res.status, ...json };
};

const checkoutSignature = (razorpayOrderId: string, paymentId: string) =>
  crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");

const createBatch = async (quantityKg = 500, pricePerKg = 45) => {
  const res = await api("POST", "/inventory", users.farmer.token, {
    category: "fresh",
    quantityKg,
    pricePerKg,
    location: "Nashik, Maharashtra",
  });
  expect(res.status).toBe(201);
  return res.data._id as string;
};

const placeOrder = (batchId: string, quantityKg: number, token = users.client.token) =>
  api("POST", "/orders", token, {
    inventoryBatchId: batchId,
    quantityKg,
    destination: "Mumbai, Maharashtra",
  });

/** Runs initiate + verify exactly as the browser flow does. */
const payForOrder = async (orderId: string, token = users.client.token) => {
  const init = await api("POST", "/payments/initiate", token, { orderId });
  expect(init.status).toBe(201);
  const razorpayOrderId = init.data.razorpayOrderId as string;
  const paymentId = `pay_${crypto.randomBytes(6).toString("hex")}`;
  const verify = await api("POST", "/payments/verify", token, {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: checkoutSignature(razorpayOrderId, paymentId),
  });
  return { razorpayOrderId, paymentId, verify };
};

const setStatus = (orderId: string, orderStatus: string, token = users.farmer.token) =>
  api("PUT", `/orders/${orderId}/status`, token, { orderStatus });

const batchQty = async (batchId: string) =>
  (await InventoryBatch.findById(batchId).lean())!.quantityKg;

const orderRef = (orderId: string) => `#ORD-${orderId.slice(-6).toUpperCase()}`;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  server = http.createServer(app);
  initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await makeUser("farmer", "farmer");
  await makeUser("farmer2", "farmer");
  await makeUser("client", "client");
  await makeUser("client2", "client");
  await makeUser("admin", "admin");
});

// ─── Stock reservation ────────────────────────────────────────────────────────

describe("inventory reservation", () => {
  it("reserves stock atomically: 500 kg − 300 kg order leaves 200 kg", async () => {
    const batchId = await createBatch(500);
    const res = await placeOrder(batchId, 300);

    expect(res.status).toBe(201);
    expect(res.data.orderStatus).toBe("pending");
    expect(res.data.paymentStatus).toBe("pending");
    expect(await batchQty(batchId)).toBe(200);
  });

  it("rejects an order for more than the available quantity", async () => {
    const batchId = await createBatch(10);
    const res = await placeOrder(batchId, 15);

    expect(res.status).toBe(400);
    expect(res.message).toBe("Only 10 kg available in this batch");
    expect(await batchQty(batchId)).toBe(10);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("does not oversell under concurrent orders", async () => {
    const batchId = await createBatch(500);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => placeOrder(batchId, 150))
    );

    const succeeded = results.filter((r) => r.status === 201);
    expect(succeeded).toHaveLength(3); // 3 × 150 = 450 ≤ 500; a 4th would oversell
    expect(results.filter((r) => r.status === 400)).toHaveLength(3);
    expect(await batchQty(batchId)).toBe(50);
    expect(await Order.countDocuments()).toBe(3);
  });

  it("marks a fully drained batch reserved and re-opens it when the order is cancelled", async () => {
    const batchId = await createBatch(100);
    const order = await placeOrder(batchId, 100);
    expect((await InventoryBatch.findById(batchId).lean())!.status).toBe("reserved");

    const cancel = await api("DELETE", `/orders/${order.data._id}`, users.client.token);
    expect(cancel.status).toBe(200);

    const batch = (await InventoryBatch.findById(batchId).lean())!;
    expect(batch.quantityKg).toBe(100);
    expect(batch.status).toBe("available");
  });
});

// ─── Happy path & transitions ────────────────────────────────────────────────

describe("order lifecycle", () => {
  it("runs PENDING → ACCEPTED → PACKAGED → SHIPPED → DELIVERED with payment tracked separately", async () => {
    const batchId = await createBatch(500);
    const { data: created } = await placeOrder(batchId, 300);
    const orderId = created._id as string;

    const { verify } = await payForOrder(orderId);
    expect(verify.status).toBe(200);
    let order = (await Order.findById(orderId).lean())!;
    expect(order.orderStatus).toBe("pending"); // paying does not move the order
    expect(order.paymentStatus).toBe("paid");

    const steps: Array<[string, string]> = [
      ["accept", "accepted"],
      ["packaged", "packaged"],
      ["shipped", "shipped"],
      ["delivered", "delivered"],
    ];
    for (const [action, expected] of steps) {
      const res =
        action === "accept"
          ? await api("PUT", `/orders/${orderId}/accept`, users.farmer.token)
          : await setStatus(orderId, action);
      expect(res.status, `${action}: ${res.message}`).toBe(200);
      expect(res.data.orderStatus).toBe(expected);
      expect(res.data.paymentStatus).toBe("paid");

      order = (await Order.findById(orderId).lean())!;
      expect(order.orderStatus).toBe(expected);
      expect(order.paymentStatus).toBe("paid");
    }

    expect(order.statusHistory.map((h) => h.status)).toEqual([
      "pending", "accepted", "packaged", "shipped", "delivered",
    ]);
    // Delivery never touches stock that other clients can still buy.
    expect(await batchQty(batchId)).toBe(200);
  });

  it("does not advance ACCEPTED automatically", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    await payForOrder(data._id);
    await api("PUT", `/orders/${data._id}/accept`, users.farmer.token);

    expect((await Order.findById(data._id).lean())!.orderStatus).toBe("accepted");
  });

  it("rejects invalid transitions with a 400 and leaves the order unchanged", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const orderId = data._id as string;
    await payForOrder(orderId);

    // PENDING → PACKAGED / SHIPPED / DELIVERED
    for (const target of ["packaged", "shipped", "delivered"]) {
      const res = await setStatus(orderId, target);
      expect(res.status).toBe(400);
      expect(res.message).toContain("Cannot move order from 'pending'");
    }

    // An unknown / backwards target is rejected by validation
    expect((await setStatus(orderId, "pending")).status).toBe(400);

    // Walk to DELIVERED, then try to go back
    await api("PUT", `/orders/${orderId}/accept`, users.farmer.token);
    await setStatus(orderId, "packaged");
    await setStatus(orderId, "shipped");
    await setStatus(orderId, "delivered");

    for (const target of ["packaged", "shipped", "cancelled"]) {
      const res = await setStatus(orderId, target);
      expect(res.status).toBe(400);
    }
    expect((await Order.findById(orderId).lean())!.orderStatus).toBe("delivered");
  });

  it("rejects a second accept from a double click (stale transition)", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    await payForOrder(data._id);

    const [a, b] = await Promise.all([
      api("PUT", `/orders/${data._id}/accept`, users.farmer.token),
      api("PUT", `/orders/${data._id}/accept`, users.farmer.token),
    ]);
    const statuses = [a.status, b.status];
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    // The loser either lost the conditional update (409) or saw the new status (400).
    expect(statuses.every((s) => [200, 400, 409].includes(s))).toBe(true);
    expect((await Order.findById(data._id).lean())!.orderStatus).toBe("accepted");
    expect(await Notification.countDocuments({ type: "order_accepted" })).toBe(1);
  });

  it("does not let another farmer or the client drive fulfilment", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    await payForOrder(data._id);

    expect((await api("PUT", `/orders/${data._id}/accept`, users.farmer2.token)).status).toBe(403);
    expect((await setStatus(data._id, "packaged", users.client.token)).status).toBe(403);
  });

  it("supports orders stored with the legacy 'packed' status", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    await payForOrder(data._id);
    await Order.updateOne({ _id: data._id }, { $set: { orderStatus: "packed" } });

    const read = await api("GET", `/orders/${data._id}`, users.farmer.token);
    expect(read.data.orderStatus).toBe("packaged");

    const shipped = await setStatus(data._id, "shipped");
    expect(shipped.status).toBe(200);
    expect(shipped.data.orderStatus).toBe("shipped");
  });
});

// ─── Payment gates ────────────────────────────────────────────────────────────

describe("unpaid orders", () => {
  it("cannot be accepted or packaged until payment is verified", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);

    const accept = await api("PUT", `/orders/${data._id}/accept`, users.farmer.token);
    expect(accept.status).toBe(400);
    expect(accept.message).toContain("Payment has not been received");

    const pack = await setStatus(data._id, "packaged");
    expect(pack.status).toBe(400);

    // Even if an order was accepted unpaid (old workflow), it cannot be packaged.
    await Order.updateOne({ _id: data._id }, { $set: { orderStatus: "accepted" } });
    const packAccepted = await setStatus(data._id, "packaged");
    expect(packAccepted.status).toBe(400);
    expect(packAccepted.message).toContain("Payment has not been received");

    const order = (await Order.findById(data._id).lean())!;
    expect(order.orderStatus).toBe("accepted");
    expect(order.paymentStatus).toBe("pending");
  });

  it("can still be rejected by the farmer, restoring stock", async () => {
    const batchId = await createBatch(500);
    const { data } = await placeOrder(batchId, 120);
    expect(await batchQty(batchId)).toBe(380);

    const res = await api("PUT", `/orders/${data._id}/reject`, users.farmer.token);
    expect(res.status).toBe(200);
    expect(res.data.orderStatus).toBe("cancelled");
    expect(await batchQty(batchId)).toBe(500);
  });
});

// ─── Cancellation & stock ────────────────────────────────────────────────────

describe("cancellation", () => {
  it("restores stock exactly once when cancel requests race", async () => {
    const batchId = await createBatch(500);
    const { data } = await placeOrder(batchId, 200);

    const results = await Promise.all([
      api("DELETE", `/orders/${data._id}`, users.client.token),
      api("DELETE", `/orders/${data._id}`, users.client.token),
      api("PUT", `/orders/${data._id}/reject`, users.farmer.token),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await batchQty(batchId)).toBe(500);
  });

  it("restores stock when a paid, accepted order is cancelled by the farmer", async () => {
    const batchId = await createBatch(500);
    const { data } = await placeOrder(batchId, 300);
    await payForOrder(data._id);
    await api("PUT", `/orders/${data._id}/accept`, users.farmer.token);

    const res = await setStatus(data._id, "cancelled");
    expect(res.status).toBe(200);
    expect(await batchQty(batchId)).toBe(500);

    const order = (await Order.findById(data._id).lean())!;
    expect(order.paymentStatus).toBe("paid"); // payment record is not rewritten
    expect(order.cancelledBy).toBe("farmer");

    const clientNote = await Notification.findOne({ userId: users.client.id, type: "order_cancelled" }).lean();
    expect(clientNote!.message).toContain("refunds are not automatic");
  });

  it("does not return shipped goods to stock when a shipped order is cancelled", async () => {
    const batchId = await createBatch(500);
    const { data } = await placeOrder(batchId, 300);
    await payForOrder(data._id);
    await api("PUT", `/orders/${data._id}/accept`, users.farmer.token);
    await setStatus(data._id, "packaged");
    await setStatus(data._id, "shipped");

    expect((await setStatus(data._id, "cancelled")).status).toBe(200);
    expect(await batchQty(batchId)).toBe(200);
  });

  it("stops a client from cancelling an order they have already paid for", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    await payForOrder(data._id);

    const res = await api("DELETE", `/orders/${data._id}`, users.client.token);
    expect(res.status).toBe(400);
    expect(res.message).toContain("already been paid");
    expect((await Order.findById(data._id).lean())!.orderStatus).toBe("pending");
  });

  it("lets an admin cancel but not fulfil", async () => {
    const batchId = await createBatch(500);
    const { data } = await placeOrder(batchId, 100);

    expect((await setStatus(data._id, "packaged", users.admin.token)).status).toBe(403);
    expect((await setStatus(data._id, "cancelled", users.admin.token)).status).toBe(200);
    expect(await batchQty(batchId)).toBe(500);
  });
});

// ─── Payments ─────────────────────────────────────────────────────────────────

describe("payments", () => {
  it("verification is idempotent and does not duplicate notifications", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const { razorpayOrderId, paymentId, verify } = await payForOrder(data._id);
    expect(verify.data.alreadyProcessed).toBe(false);

    const replay = await api("POST", "/payments/verify", users.client.token, {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: checkoutSignature(razorpayOrderId, paymentId),
    });
    expect(replay.status).toBe(200);
    expect(replay.data.alreadyProcessed).toBe(true);

    expect(await Notification.countDocuments({ type: "payment_success", userId: users.farmer.id })).toBe(1);
    expect(await Notification.countDocuments({ type: "payment_success", userId: users.client.id })).toBe(1);
    expect(await Payment.countDocuments({ orderId: data._id })).toBe(1);
  });

  it("rejects a forged signature and leaves the payment pending", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const init = await api("POST", "/payments/initiate", users.client.token, { orderId: data._id });

    const res = await api("POST", "/payments/verify", users.client.token, {
      razorpay_order_id: init.data.razorpayOrderId,
      razorpay_payment_id: "pay_forged",
      razorpay_signature: "ab".repeat(32),
    });
    expect(res.status).toBe(400);
    expect((await Order.findById(data._id).lean())!.paymentStatus).toBe("pending");
  });

  it("a paid payment cannot be changed to FAILED", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const { razorpayOrderId } = await payForOrder(data._id);

    const res = await api("POST", "/payments/failed", users.client.token, {
      razorpay_order_id: razorpayOrderId,
      error_description: "tampering attempt",
    });
    expect(res.status).toBe(409);
    expect((await Payment.findOne({ razorpayOrderId }).lean())!.status).toBe("paid");
    expect((await Order.findById(data._id).lean())!.paymentStatus).toBe("paid");
  });

  it("records a failed payment on both the payment and the order, and allows a retry", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const init = await api("POST", "/payments/initiate", users.client.token, { orderId: data._id });

    const failed = await api("POST", "/payments/failed", users.client.token, {
      razorpay_order_id: init.data.razorpayOrderId,
      error_description: "Card declined",
    });
    expect(failed.status).toBe(200);
    const farmerView = await api("GET", `/orders/${data._id}`, users.farmer.token);
    expect(farmerView.data.paymentStatus).toBe("failed");
    expect(farmerView.data.orderStatus).toBe("pending");

    const { verify } = await payForOrder(data._id);
    expect(verify.status).toBe(200);
    expect((await Order.findById(data._id).lean())!.paymentStatus).toBe("paid");
  });

  it("a client cannot read or settle another client's payment", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const init = await api("POST", "/payments/initiate", users.client.token, { orderId: data._id });

    expect((await api("GET", `/payments/${data._id}`, users.client2.token)).status).toBe(403);
    expect((await api("GET", `/orders/${data._id}`, users.client2.token)).status).toBe(403);
    expect((await api("GET", `/payments/${data._id}`, users.client.token)).status).toBe(200);

    const list = await api("GET", "/payments", users.client2.token);
    expect(list.data).toHaveLength(0);

    const razorpayOrderId = init.data.razorpayOrderId as string;
    const verify = await api("POST", "/payments/verify", users.client2.token, {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: "pay_x",
      razorpay_signature: checkoutSignature(razorpayOrderId, "pay_x"),
    });
    expect(verify.status).toBe(403);

    const fail = await api("POST", "/payments/failed", users.client2.token, {
      razorpay_order_id: razorpayOrderId,
    });
    expect(fail.status).toBe(403);
    expect((await Order.findById(data._id).lean())!.paymentStatus).toBe("pending");
  });

  it("webhook payment.captured reconciles a payment exactly once", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const init = await api("POST", "/payments/initiate", users.client.token, { orderId: data._id });

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_webhook1", order_id: init.data.razorpayOrderId } } },
    });
    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");

    const bad = await api("POST", "/payments/webhook", undefined, body, { "x-razorpay-signature": "00".repeat(32) });
    expect(bad.status).toBe(400);

    for (let i = 0; i < 2; i++) {
      const res = await api("POST", "/payments/webhook", undefined, body, { "x-razorpay-signature": sig });
      expect(res.status).toBe(200);
    }
    expect((await Order.findById(data._id).lean())!.paymentStatus).toBe("paid");
    expect(await Notification.countDocuments({ type: "payment_success", userId: users.farmer.id })).toBe(1);
  });
});

// ─── Notifications ───────────────────────────────────────────────────────────

describe("notifications", () => {
  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = ioClient(baseUrl, { auth: { token }, transports: ["websocket"] });
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", reject);
    });

  const nextEvent = <T>(socket: Socket, event: string, match: (p: T) => boolean = () => true) =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 5000);
      const handler = (payload: T) => {
        if (!match(payload)) return;
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      };
      socket.on(event, handler);
    });

  it("persists the right notifications with the real order ID", async () => {
    const batchId = await createBatch();
    const { data } = await placeOrder(batchId, 50);
    const orderId = data._id as string;
    const ref = orderRef(orderId);

    const placed = await Notification.findOne({ userId: users.farmer.id, type: "order_placed" }).lean();
    expect(placed!.relatedId!.toString()).toBe(orderId);
    expect(placed!.message).toContain(`New order ${ref} is waiting for payment`);

    await payForOrder(orderId);
    const paid = await Notification.findOne({ userId: users.farmer.id, type: "payment_success" }).lean();
    expect(paid!.message).toBe(`Payment received for Order ${ref}.`);
    expect(paid!.relatedId!.toString()).toBe(orderId);

    await api("PUT", `/orders/${orderId}/accept`, users.farmer.token);
    await setStatus(orderId, "packaged");
    await setStatus(orderId, "shipped");

    const clientMessages = (
      await Notification.find({ userId: users.client.id, type: /^order_/ }).sort({ createdAt: 1 }).lean()
    ).map((n) => [n.type, n.message, n.relatedId!.toString()]);
    expect(clientMessages).toEqual([
      ["order_accepted", `Your order ${ref} has been accepted by the farmer.`, orderId],
      ["order_packaged", `Your order ${ref} has been packaged.`, orderId],
      ["order_shipped", `Your order ${ref} has been shipped.`, orderId],
    ]);
  });

  it("emits the saved notification document (real _id) and an order:updated event", async () => {
    const batchId = await createBatch();
    const farmerSocket = await connect(users.farmer.token);
    const clientSocket = await connect(users.client.token);

    try {
      const placedEvent = nextEvent<{ _id: string; relatedId: string; type: string }>(
        farmerSocket, "notification:new", (p) => p.type === "order_placed"
      );
      const { data } = await placeOrder(batchId, 50);
      const orderId = data._id as string;

      const placed = await placedEvent;
      expect(placed.relatedId).toBe(orderId);
      expect(await Notification.exists({ _id: placed._id, userId: users.farmer.id })).toBeTruthy();

      const farmerPaid = nextEvent<{ _id: string; message: string }>(
        farmerSocket, "notification:new", (p) => (p as never as { type: string }).type === "payment_success"
      );
      const farmerOrderUpdate = nextEvent<{ orderId: string }>(farmerSocket, "order:updated");
      await payForOrder(orderId);

      const paidNote = await farmerPaid;
      expect(paidNote.message).toBe(`Payment received for Order ${orderRef(orderId)}.`);
      expect(await Notification.exists({ _id: paidNote._id })).toBeTruthy();
      expect(await farmerOrderUpdate).toEqual({ orderId }); // carries no status — clients re-fetch

      const clientUpdate = nextEvent<{ orderId: string }>(clientSocket, "order:updated");
      await api("PUT", `/orders/${orderId}/accept`, users.farmer.token);
      expect(await clientUpdate).toEqual({ orderId });
    } finally {
      farmerSocket.disconnect();
      clientSocket.disconnect();
    }
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("login", () => {
  it("returns 'Invalid email or password.' for a wrong password", async () => {
    const res = await api("POST", "/auth/login", undefined, {
      email: "client@test.dev",
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
    expect(res.message).toBe("Invalid email or password.");
  });
});
