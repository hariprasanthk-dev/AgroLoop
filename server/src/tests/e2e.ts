import mongoose from "mongoose";
import crypto from "crypto";
import app from "../app";
import { connectDB } from "../config/db";
import { env } from "../config/env";
import User from "../models/User.model";
import InventoryBatch from "../models/InventoryBatch.model";
import Order from "../models/Order.model";
import Payment from "../models/Payment.model";
import Notification from "../models/Notification.model";

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

let server: any;

// Helper to handle requests easily
async function apiRequest(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  body?: any,
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { rawText: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data: json,
  };
}

async function runTests() {
  console.log("\n🚀 Starting AgroLoop End-to-End API Integration Tests...\n");

  // 1. Database Connection
  await connectDB();

  // Start server
  server = app.listen(PORT, () => {
    console.log(`📡 Test server running on port ${PORT}`);
  });

  // 2. Database Cleanup
  console.log("🧹 Cleaning up old test data...");
  const testEmails = [
    "test.farmer@agroloop.com",
    "test.client@agroloop.com",
    "test.admin@agroloop.com",
  ];
  const existingTestUsers = await User.find({ email: { $in: testEmails } });
  const testUserIds = existingTestUsers.map((u) => u._id);

  await Promise.all([
    User.deleteMany({ email: { $in: testEmails } }),
    InventoryBatch.deleteMany({ farmerId: { $in: testUserIds } }),
    Order.deleteMany({ clientId: { $in: testUserIds } }),
    Notification.deleteMany({ userId: { $in: testUserIds } }),
  ]);
  // Clean up orphan payments
  await Payment.deleteMany({});
  console.log("✅ Cleanup completed.");

  // Test states
  let farmerToken = "";
  let clientToken = "";
  let adminToken = "";
  let freshBatchId = "";
  let sproutedBatchId = "";
  let rottenBatchId = "";
  let testOrderId = "";
  let razorpayOrderId = "";

  // ─── 1. AUTHENTICATION TESTS ───
  console.log("\n🔑 Running Authentication Tests...");

  // Farmer registration
  const farmerReg = await apiRequest(`${BASE_URL}/auth/register`, "POST", {
    name: "Test Farmer",
    email: "test.farmer@agroloop.com",
    password: "password123",
    role: "farmer",
  });
  if (farmerReg.status !== 201) throw new Error("Farmer registration failed");
  console.log("🔹 Farmer registration: PASS");

  // Client registration
  const clientReg = await apiRequest(`${BASE_URL}/auth/register`, "POST", {
    name: "Test Client",
    email: "test.client@agroloop.com",
    password: "password123",
    role: "client",
  });
  if (clientReg.status !== 201) throw new Error("Client registration failed");
  console.log("🔹 Client registration: PASS");

  // Admin direct database creation (public API restricts registering admin roles directly for security)
  await User.create({
    name: "Test Admin",
    email: "test.admin@agroloop.com",
    password: "password123",
    role: "admin",
  });
  console.log("🔹 Admin DB seeding: PASS");

  // Logins
  const farmerLogin = await apiRequest(`${BASE_URL}/auth/login`, "POST", {
    email: "test.farmer@agroloop.com",
    password: "password123",
  });
  if (!farmerLogin.ok) throw new Error("Farmer login failed");
  farmerToken = farmerLogin.data.data.token;

  const clientLogin = await apiRequest(`${BASE_URL}/auth/login`, "POST", {
    email: "test.client@agroloop.com",
    password: "password123",
  });
  if (!clientLogin.ok) throw new Error("Client login failed");
  clientToken = clientLogin.data.data.token;

  const adminLogin = await apiRequest(`${BASE_URL}/auth/login`, "POST", {
    email: "test.admin@agroloop.com",
    password: "password123",
  });
  if (!adminLogin.ok) throw new Error("Admin login failed");
  adminToken = adminLogin.data.data.token;
  console.log("🔹 Login tokens retrieved: PASS");

  // ─── 2. INVENTORY CLASSIFICATION & MGMT TESTS ───
  console.log("\n🧅 Running Inventory & Classification Tests...");

  // Batch A: Newly harvested -> should be Grade A (Fresh)
  const today = new Date().toISOString();
  const batchA = await apiRequest(`${BASE_URL}/inventory`, "POST", {
    category: "fresh",
    quantityKg: 100,
    pricePerKg: 30,
    location: "Nashik, MH",
    harvestDate: today,
    description: "Newly harvested onions",
  }, farmerToken);
  if (!batchA.ok) throw new Error("Batch A creation failed: " + JSON.stringify(batchA.data));
  freshBatchId = batchA.data.data._id;
  if (batchA.data.data.category !== "fresh") throw new Error("Batch A should be fresh");
  console.log("🔹 Create Batch A (Fresh / Grade A): PASS");

  // Batch B: Harvest exceeds 30 days -> should be Sprouted
  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const batchB = await apiRequest(`${BASE_URL}/inventory`, "POST", {
    category: "fresh", // Farmer tries to list as fresh
    quantityKg: 50,
    pricePerKg: 15,
    location: "Nashik, MH",
    harvestDate: fortyDaysAgo,
    description: "Old harvest",
  }, farmerToken);
  if (!batchB.ok) throw new Error("Batch B creation failed");
  sproutedBatchId = batchB.data.data._id;
  // Trigger fetch list to verify on-the-fly classifications
  const listB = await apiRequest(`${BASE_URL}/inventory`, "GET", undefined, farmerToken);
  const updatedB = listB.data.data.find((b: any) => b._id === sproutedBatchId);
  if (updatedB.category !== "sprouted") {
    throw new Error(`Batch B should have sprouted. Got category: ${updatedB.category}`);
  }
  console.log("🔹 Create Batch B (Auto-classification → Sprouted): PASS");

  // Batch C: Unsold for 60+ days -> should be Rotten
  // We can write directly to DB then query to test list classification
  const sixtyFiveDaysAgo = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000);
  const activeFarmer = await User.findOne({ email: "test.farmer@agroloop.com" });
  const rawBatchC = await InventoryBatch.create({
    farmerId: activeFarmer?._id || new mongoose.Types.ObjectId(),
    category: "fresh",
    quantityKg: 30,
    pricePerKg: 10,
    location: "Nashik, MH",
    intakeDate: sixtyFiveDaysAgo,
    harvestDate: fortyDaysAgo,
    status: "available",
  });
  rottenBatchId = String(rawBatchC._id);

  // Trigger sync on list
  const listC = await apiRequest(`${BASE_URL}/inventory`, "GET", undefined, farmerToken);
  const updatedC = listC.data.data.find((b: any) => b._id === rottenBatchId);
  if (updatedC.category !== "rotten" || updatedC.status !== "expired") {
    throw new Error(`Batch C should be rotten & expired. Got category: ${updatedC?.category}, status: ${updatedC?.status}`);
  }
  console.log("🔹 Create Batch C (Auto-classification → Rotten & Expired): PASS");

  // ─── 3. ORDER TESTS ───
  console.log("\n🛒 Running Order Tests...");

  // Client places order on Batch A (100kg total) for 20kg
  const placeOrder = await apiRequest(`${BASE_URL}/orders`, "POST", {
    inventoryBatchId: freshBatchId,
    quantityKg: 20,
    destination: "Mumbai Warehouse",
    notes: "Please pack cleanly",
  }, clientToken);
  if (!placeOrder.ok) throw new Error("Order placement failed: " + JSON.stringify(placeOrder.data));
  testOrderId = placeOrder.data.data._id;
  if (placeOrder.data.data.totalAmount !== 600) throw new Error("Incorrect total amount computation");
  console.log("🔹 Client places order (quantity 20kg): PASS");

  // Assert stock decreased in DB (100kg -> 80kg)
  const freshBatchDoc = await InventoryBatch.findById(freshBatchId);
  if (freshBatchDoc?.quantityKg !== 80) {
    throw new Error(`Stock decrement failed. Expected 80kg, got: ${freshBatchDoc?.quantityKg}kg`);
  }
  console.log("🔹 Stock decremented immediately on placement: PASS");

  // ─── RACE CONDITION TEST ───
  // Verify the atomic findOneAndUpdate prevents overselling under concurrency.
  // Create a new batch with exactly 10 kg, then fire two simultaneous order
  // requests for 10 kg each. Only one should succeed; inventory must never go negative.
  console.log("\n⚡ Running Race Condition / Concurrent Order Test...");

  const raceBatch = await apiRequest(`${BASE_URL}/inventory`, "POST", {
    category: "fresh",
    quantityKg: 10,
    pricePerKg: 50,
    location: "Nashik, MH",
    harvestDate: today,
    description: "Race condition test batch (10 kg only)",
  }, farmerToken);
  if (!raceBatch.ok) throw new Error("Race batch creation failed: " + JSON.stringify(raceBatch.data));
  const raceBatchId = raceBatch.data.data._id;
  console.log(`🔹 Created race-condition test batch (10 kg) [ID: ...${String(raceBatchId).slice(-6)}]: PASS`);

  // Fire two simultaneous requests — both attempt to claim all 10 kg
  const [raceResult1, raceResult2] = await Promise.all([
    apiRequest(`${BASE_URL}/orders`, "POST", {
      inventoryBatchId: raceBatchId,
      quantityKg: 10,
      destination: "Race Test Warehouse A",
    }, clientToken),
    apiRequest(`${BASE_URL}/orders`, "POST", {
      inventoryBatchId: raceBatchId,
      quantityKg: 10,
      destination: "Race Test Warehouse B",
    }, clientToken),
  ]);

  const successes = [raceResult1, raceResult2].filter((r) => r.status === 201);
  const failures  = [raceResult1, raceResult2].filter((r) => r.status === 400);

  if (successes.length !== 1) {
    throw new Error(
      `Race condition detected! Expected exactly 1 success, got ${successes.length}. ` +
      `Results: [${raceResult1.status}, ${raceResult2.status}]`
    );
  }
  if (failures.length !== 1) {
    throw new Error(
      `Race condition detected! Expected exactly 1 failure (400), got ${failures.length}.`
    );
  }
  console.log("🔹 Concurrent orders: exactly 1 succeeded, 1 rejected (400): PASS");

  // Verify inventory is 0 — never negative
  const raceBatchDoc = await InventoryBatch.findById(raceBatchId);
  if (raceBatchDoc === null) throw new Error("Race batch document not found in DB");
  if (raceBatchDoc.quantityKg !== 0) {
    throw new Error(
      `Inventory consistency error! Expected 0 kg remaining, got ${raceBatchDoc.quantityKg} kg`
    );
  }
  if (raceBatchDoc.quantityKg < 0) {
    throw new Error(`CRITICAL: Inventory went NEGATIVE (${raceBatchDoc.quantityKg} kg)!`);
  }
  console.log(`🔹 Inventory after race: ${raceBatchDoc.quantityKg} kg (never negative): PASS`);
  console.log("✅ Race Condition Test: PASS\n");

  // Farmer accepts order
  const acceptOrd = await apiRequest(`${BASE_URL}/orders/${testOrderId}/accept`, "PUT", {}, farmerToken);
  if (!acceptOrd.ok) throw new Error("Farmer order accept failed");
  if (acceptOrd.data.data.orderStatus !== "accepted") throw new Error("Order status should be accepted");
  console.log("🔹 Farmer accepts pending order: PASS");

  // ─── 4. PAYMENT TESTS ───
  console.log("\n💳 Running Payment Tests...");

  // Client initiates payment
  const initiatePay = await apiRequest(`${BASE_URL}/payments/initiate`, "POST", {
    orderId: testOrderId,
  }, clientToken);
  if (!initiatePay.ok) throw new Error("Payment initiation failed: " + JSON.stringify(initiatePay.data));
  razorpayOrderId = initiatePay.data.data.razorpayOrderId;
  console.log("🔹 Client initiates payment: PASS");

  // Compute a real HMAC-SHA256 signature matching Razorpay's algorithm.
  // This exercises the actual verification path — no bypass involved.
  const testPaymentId = "pay_test_id_12345";
  const computedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${testPaymentId}`)
    .digest("hex");

  // Simulate payment verification success
  const verifyPayRes = await apiRequest(`${BASE_URL}/payments/verify`, "POST", {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: testPaymentId,
    razorpay_signature: computedSignature,
  }, clientToken);

  if (!verifyPayRes.ok) throw new Error("Payment verification failed: " + JSON.stringify(verifyPayRes.data));
  console.log("🔹 Client verifies payment signature: PASS");

  // Assert order is paid
  const updatedOrder = await Order.findById(testOrderId);
  if (updatedOrder?.paymentStatus !== "paid") {
    throw new Error("Order should be paid. Got: " + updatedOrder?.paymentStatus);
  }
  console.log("🔹 Order marked as paid: PASS");

  // Farmer advances status to delivered: accepted -> packed -> shipped -> delivered
  const packedState = await apiRequest(`${BASE_URL}/orders/${testOrderId}/status`, "PUT", { orderStatus: "packed" }, farmerToken);
  if (!packedState.ok) throw new Error("Status to packed failed: " + JSON.stringify(packedState.data));

  const shippedState = await apiRequest(`${BASE_URL}/orders/${testOrderId}/status`, "PUT", { orderStatus: "shipped" }, farmerToken);
  if (!shippedState.ok) throw new Error("Status to shipped failed");

  const deliveredState = await apiRequest(`${BASE_URL}/orders/${testOrderId}/status`, "PUT", { orderStatus: "delivered" }, farmerToken);
  if (!deliveredState.ok) throw new Error("Status to delivered failed");
  console.log("🔹 Farmer advances order status accepted → packed → shipped → delivered: PASS");

  // Assert batch status is now sold
  const finalBatch = await InventoryBatch.findById(freshBatchId);
  if (finalBatch?.status !== "sold") {
    throw new Error("Batch status should be 'sold' after delivery. Got: " + finalBatch?.status);
  }
  console.log("🔹 Batch marked as SOLD on order delivery: PASS");

  // ─── 5. NOTIFICATION TESTS ───
  console.log("\n🔔 Running Notification Tests...");
  const clientNotifs = await apiRequest(`${BASE_URL}/notifications`, "GET", undefined, clientToken);
  if (!clientNotifs.ok || clientNotifs.data.data.length === 0) {
    throw new Error("No client notifications found");
  }
  console.log("🔹 Retrieve client notifications: PASS");

  const farmerNotifs = await apiRequest(`${BASE_URL}/notifications`, "GET", undefined, farmerToken);
  if (!farmerNotifs.ok || farmerNotifs.data.data.length === 0) {
    throw new Error("No farmer notifications found");
  }
  console.log("🔹 Retrieve farmer notifications: PASS");

  // ─── 6. ADMIN DASHBOARD STATS TESTS ───
  console.log("\n📊 Running Admin Dashboard Stats Tests...");
  const adminStats = await apiRequest(`${BASE_URL}/admin/stats`, "GET", undefined, adminToken);
  if (!adminStats.ok) throw new Error("Admin stats retrieval failed: " + JSON.stringify(adminStats.data));
  
  const statsData = adminStats.data.data;
  console.log("📊 STATS DATA FROM SERVER:", JSON.stringify(statsData, null, 2));
  if (statsData.totalFarmers < 1) throw new Error("Stats should show at least 1 farmer");
  if (statsData.totalClients < 1) throw new Error("Stats should show at least 1 client");
  if (statsData.revenue < 600) throw new Error("Stats revenue should represent at least paid order amount (₹600)");
  if (statsData.wasteStats.sproutedKg < 50) throw new Error("Stats sproutedKg should show at least 50");
  if (statsData.wasteStats.rottenKg < 30) throw new Error("Stats rottenKg should show at least 30");
  console.log("🔹 Admin dashboard aggregation: PASS");

  console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! 🎉\n");
  cleanupAndExit(0);
}

function cleanupAndExit(code: number) {
  if (server) {
    server.close(() => {
      console.log("📡 Test server closed.");
      mongoose.disconnect().then(() => {
        console.log("🔌 Database disconnected.");
        process.exit(code);
      });
    });
  } else {
    process.exit(code);
  }
}

// Global error handler
process.on("unhandledRejection", (err) => {
  console.error("\n❌ Test Failed with error:\n", err);
  cleanupAndExit(1);
});

// Run
runTests().catch((err) => {
  console.error("\n❌ Test Failed with error:\n", err);
  cleanupAndExit(1);
});
