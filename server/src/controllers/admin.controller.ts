import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import User from "../models/User.model";
import InventoryBatch from "../models/InventoryBatch.model";
import Order from "../models/Order.model";
import Payment from "../models/Payment.model";
import { syncInventoryClassification } from "../services/inventory.service";

/**
 * Get unified statistics for the Admin Dashboard.
 * Includes:
 * - Farmers and Clients counts
 * - Inventory breakdown (fresh, sprouted, rotten)
 * - Order breakdown by status
 * - Payments statistics (total revenue, paid count, pending count)
 * - Waste statistics (rotten, sprouted, fresh, and waste reduction percentage)
 * - Recent sales history (last 30 days)
 */
export const getDashboardStats = asyncHandler(
  async (_req: Request, res: Response) => {
    // 1. Sync inventory classification first to ensure time-elapsed updates are applied
    await syncInventoryClassification();

    // 2. Total farmers and clients
    const [totalFarmers, totalClients] = await Promise.all([
      User.countDocuments({ role: "farmer" }),
      User.countDocuments({ role: "client" }),
    ]);

    // 3. Total inventory and category breakdown
    const inventoryStats = await InventoryBatch.aggregate([
      {
        $group: {
          _id: "$category",
          totalKg: { $sum: "$quantityKg" },
          batchesCount: { $sum: 1 },
        },
      },
    ]);

    const inventoryBreakdown = {
      fresh: 0,
      sprouted: 0,
      rotten: 0,
    };
    let totalInventoryKg = 0;
    inventoryStats.forEach((stat) => {
      if (stat._id === "fresh") inventoryBreakdown.fresh = stat.totalKg;
      if (stat._id === "sprouted") inventoryBreakdown.sprouted = stat.totalKg;
      if (stat._id === "rotten") inventoryBreakdown.rotten = stat.totalKg;
      totalInventoryKg += stat.totalKg;
    });

    // 4. Total orders and order breakdown
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
        },
      },
    ]);

    const orderBreakdown = {
      pending: 0,
      accepted: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    let totalOrders = 0;
    orderStats.forEach((stat) => {
      if (stat._id in orderBreakdown) {
        orderBreakdown[stat._id as keyof typeof orderBreakdown] = stat.count;
      }
      totalOrders += stat.count;
    });

    // 5. Payments and revenue (paid status sum)
    const payments = await Payment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    let revenue = 0;
    let completedPayments = 0;
    let pendingPayments = 0;

    payments.forEach((p) => {
      if (p._id === "paid") {
        revenue = p.totalAmount;
        completedPayments = p.count;
      } else if (p._id === "pending") {
        pendingPayments = p.count;
      }
    });

    // 6. Waste statistics & reduction
    // Sprouted onions represent onions that were kept from rotting/wasting (since we reuse them/sprouted classification).
    // Let's compute waste reduction as the percentage of sprouted/reused onions to total non-fresh. Or let's say sprouted represents a form of reuse.
    // Waste Reduction % = (Sprouted / (Sprouted + Rotten)) * 100. Or (Sprouted / Total Inventory) * 100. Let's make it:
    const totalWastedOrSprouted = inventoryBreakdown.sprouted + inventoryBreakdown.rotten;
    const wasteReductionPercent = totalWastedOrSprouted > 0 
      ? Math.round((inventoryBreakdown.sprouted / totalWastedOrSprouted) * 100) 
      : 0;

    const wasteStats = {
      rottenKg: inventoryBreakdown.rotten,
      sproutedKg: inventoryBreakdown.sprouted,
      freshKg: inventoryBreakdown.fresh,
      wasteReductionPercent,
    };

    // 7. Recent sales (past 30 days of paid orders)
    const salesHistory = await Payment.aggregate([
      { $match: { status: "paid", paidAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return ApiResponse.ok(res, "Admin dashboard statistics fetched", {
      totalFarmers,
      totalClients,
      totalInventoryKg,
      totalOrders,
      revenue,
      inventoryBreakdown,
      orderBreakdown,
      paymentBreakdown: {
        totalCollected: revenue,
        completedCount: completedPayments,
        pendingCount: pendingPayments,
      },
      wasteStats,
      salesHistory,
    });
  }
);
