import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import * as OrderService from "../services/order.service";
import { AuthenticatedRequest, OrderStatus } from "../types";

// ─── Client: Place Order ──────────────────────────────────────────────────────
export const createOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await OrderService.createOrder({
      ...req.body,
      clientId: req.user!.id,
    });
    return ApiResponse.created(res, "Order placed successfully", order);
  }
);

// ─── Client: Cancel Pending Order ─────────────────────────────────────────────
export const cancelOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await OrderService.cancelOrder(
      String(req.params.id),
      req.user!.id
    );
    return ApiResponse.ok(res, "Order cancelled successfully", order);
  }
);

// ─── Farmer: Accept Order ─────────────────────────────────────────────────────
export const acceptOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await OrderService.acceptOrder(
      String(req.params.id),
      req.user!.id
    );
    return ApiResponse.ok(res, "Order accepted", order);
  }
);

// ─── Farmer: Reject Order ─────────────────────────────────────────────────────
export const rejectOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await OrderService.rejectOrder(
      String(req.params.id),
      req.user!.id
    );
    return ApiResponse.ok(res, "Order rejected", order);
  }
);

// ─── Farmer: Update Order Status ──────────────────────────────────────────────
export const updateOrderStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { orderStatus } = req.body;
    const order = await OrderService.updateOrderStatus(
      String(req.params.id),
      req.user!.id,
      orderStatus as OrderStatus
    );
    return ApiResponse.ok(res, "Order status updated", order);
  }
);

// ─── All Authenticated: List Orders ──────────────────────────────────────────
export const listOrders = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query as Record<string, string>;
    const { page, limit, orderStatus } = query;

    const params: Record<string, unknown> = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      orderStatus: orderStatus as OrderStatus,
    };

    // Scope by role
    if (req.user!.role === "client") {
      params.clientId = req.user!.id;
    } else if (req.user!.role === "farmer") {
      params.farmerId = req.user!.id;
    } else if (query.clientId) {
      // Admin can filter by clientId
      params.clientId = query.clientId;
    }

    const result = await OrderService.listOrders(params as never);

    return ApiResponse.ok(
      res,
      "Orders fetched successfully",
      result.orders,
      result.pagination
    );
  }
);

// ─── All Authenticated: Get Single Order ──────────────────────────────────────
export const getOrder = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const order = await OrderService.getOrderById(
      String(req.params.id),
      req.user!.id,
      req.user!.role
    );
    return ApiResponse.ok(res, "Order fetched successfully", order);
  }
);

// ─── Admin: Order Statistics ──────────────────────────────────────────────────
export const getOrderStats = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await OrderService.getOrderStats();
    return ApiResponse.ok(res, "Order statistics fetched", stats);
  }
);
