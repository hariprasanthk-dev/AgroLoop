import InventoryBatch, {
  InventoryBatchDocument,
} from "../models/InventoryBatch.model";
import { ApiError } from "../utils/ApiError";
import { OnionCategory, BatchStatus, PaginationMeta } from "../types";

interface CreateBatchPayload {
  farmerId: string;
  category: OnionCategory;
  quantityKg: number;
  pricePerKg: number;
  location: string;
  harvestDate?: Date;
  intakeDate?: Date;
  imageUrl?: string;
  description?: string;
}

interface UpdateBatchPayload {
  category?: OnionCategory;
  quantityKg?: number;
  pricePerKg?: number;
  status?: BatchStatus;
  location?: string;
  harvestDate?: Date;
  imageUrl?: string;
  description?: string;
}

interface ListBatchesQuery {
  page?: number;
  limit?: number;
  category?: OnionCategory;
  status?: BatchStatus;
  farmerId?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minQty?: number;
  maxQty?: number;
}

interface BatchListResult {
  batches: InventoryBatchDocument[];
  pagination: PaginationMeta;
}

export const syncInventoryClassification = async (): Promise<void> => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // 1. Rotten: Status != sold, and (status == expired OR intakeDate older than 60 days)
    await InventoryBatch.updateMany(
      {
        status: { $ne: "sold" },
        $or: [
          { status: "expired" },
          { intakeDate: { $lt: sixtyDaysAgo } }
        ]
      },
      {
        $set: { category: "rotten", status: "expired" }
      }
    );

    // 2. Sprouted: Status != sold, category != rotten, harvestDate older than 30 days
    await InventoryBatch.updateMany(
      {
        status: { $ne: "sold" },
        category: { $ne: "rotten" },
        harvestDate: { $lt: thirtyDaysAgo }
      },
      {
        $set: { category: "sprouted" }
      }
    );
  } catch (error) {
    console.error("Failed to sync inventory classifications:", error);
  }
};

export const createBatch = async (
  payload: CreateBatchPayload
): Promise<InventoryBatchDocument> => {
  return InventoryBatch.create(payload);
};

export const listBatches = async (
  query: ListBatchesQuery
): Promise<BatchListResult> => {
  await syncInventoryClassification();
  const {
    page = 1,
    limit = 20,
    category,
    status,
    farmerId,
    location,
    minPrice,
    maxPrice,
    minQty,
    maxQty,
  } = query;
  const skip = (page - 1) * limit;

  // Build dynamic filter
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (farmerId) filter.farmerId = farmerId;

  // Location: case-insensitive substring match
  if (location) {
    filter.location = { $regex: location, $options: "i" };
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) priceFilter.$gte = minPrice;
    if (maxPrice !== undefined) priceFilter.$lte = maxPrice;
    filter.pricePerKg = priceFilter;
  }

  // Quantity range filter
  if (minQty !== undefined || maxQty !== undefined) {
    const qtyFilter: Record<string, number> = {};
    if (minQty !== undefined) qtyFilter.$gte = minQty;
    if (maxQty !== undefined) qtyFilter.$lte = maxQty;
    filter.quantityKg = qtyFilter;
  }

  const [batches, total] = await Promise.all([
    InventoryBatch.find(filter)
      .populate("farmerId", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    InventoryBatch.countDocuments(filter),
  ]);

  return {
    batches,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getBatchById = async (
  id: string
): Promise<InventoryBatchDocument> => {
  await syncInventoryClassification();
  const batch = await InventoryBatch.findById(id).populate(
    "farmerId",
    "name email"
  );
  if (!batch) {
    throw ApiError.notFound("Inventory batch not found");
  }
  return batch;
};

export const updateBatch = async (
  id: string,
  requesterId: string,
  requesterRole: string,
  payload: UpdateBatchPayload
): Promise<InventoryBatchDocument> => {
  const batch = await InventoryBatch.findById(id);
  if (!batch) throw ApiError.notFound("Inventory batch not found");

  // Only the owning farmer or admin can update
  if (
    requesterRole !== "admin" &&
    batch.farmerId.toString() !== requesterId
  ) {
    throw ApiError.forbidden("You can only update your own inventory");
  }

  Object.assign(batch, payload);
  return batch.save();
};

export const deleteBatch = async (
  id: string,
  requesterId: string,
  requesterRole: string
): Promise<void> => {
  const batch = await InventoryBatch.findById(id);
  if (!batch) throw ApiError.notFound("Inventory batch not found");

  // Only the owning farmer or admin can delete
  if (
    requesterRole !== "admin" &&
    batch.farmerId.toString() !== requesterId
  ) {
    throw ApiError.forbidden("You can only delete your own inventory");
  }

  await batch.deleteOne();
};

export const getInventoryStats = async (farmerId?: string) => {
  await syncInventoryClassification();
  const matchStage: Record<string, unknown> = {};
  if (farmerId) matchStage.farmerId = farmerId;

  return InventoryBatch.aggregate([
    ...(farmerId ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id: "$category",
        totalBatches: { $sum: 1 },
        totalQuantityKg: { $sum: "$quantityKg" },
        availableQuantityKg: {
          $sum: { $cond: [{ $eq: ["$status", "available"] }, "$quantityKg", 0] },
        },
        reservedQuantityKg: {
          $sum: { $cond: [{ $eq: ["$status", "reserved"] }, "$quantityKg", 0] },
        },
        soldQuantityKg: {
          $sum: { $cond: [{ $eq: ["$status", "sold"] }, "$quantityKg", 0] },
        },
        avgPricePerKg: { $avg: "$pricePerKg" },
      },
    },
  ]);
};

export const getFarmerStats = async (farmerId: string) => {
  return getInventoryStats(farmerId);
};
