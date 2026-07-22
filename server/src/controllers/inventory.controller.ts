import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import * as InventoryService from "../services/inventory.service";
import { AuthenticatedRequest } from "../types";

export const createBatch = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const batch = await InventoryService.createBatch({
      ...req.body,
      farmerId: req.user!.id,
    });
    return ApiResponse.created(res, "Inventory batch created", batch);
  }
);

export const listBatches = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query as Record<string, string>;
    const { page, limit, category, status, location, minPrice, maxPrice, minQty, maxQty } = query;

    // Farmers only see their own batches; clients/admin see all
    const farmerId =
      req.user!.role === "farmer" ? req.user!.id : query.farmerId;

    const result = await InventoryService.listBatches({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      category: category as never,
      status: status as never,
      farmerId,
      location,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minQty: minQty ? parseFloat(minQty) : undefined,
      maxQty: maxQty ? parseFloat(maxQty) : undefined,
    });

    return ApiResponse.ok(
      res,
      "Inventory batches fetched",
      result.batches,
      result.pagination
    );
  }
);

export const getBatch = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const batch = await InventoryService.getBatchById(String(req.params.id));
    return ApiResponse.ok(res, "Inventory batch fetched", batch);
  }
);

export const updateBatch = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const batch = await InventoryService.updateBatch(
      String(req.params.id),
      req.user!.id,
      req.user!.role,
      req.body
    );
    return ApiResponse.ok(res, "Inventory batch updated", batch);
  }
);

export const deleteBatch = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await InventoryService.deleteBatch(
      String(req.params.id),
      req.user!.id,
      req.user!.role
    );
    return ApiResponse.ok(res, "Inventory batch deleted");
  }
);

export const getStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    // Farmer gets only their own stats; admin/client get global stats
    const farmerId =
      req.user!.role === "farmer" ? req.user!.id : undefined;
    const stats = await InventoryService.getInventoryStats(farmerId);
    return ApiResponse.ok(res, "Inventory statistics fetched", stats);
  }
);
