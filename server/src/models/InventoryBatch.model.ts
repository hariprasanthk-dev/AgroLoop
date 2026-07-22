import mongoose, { Schema, Document, Model } from "mongoose";
import { IInventoryBatch, OnionCategory, BatchStatus } from "../types";

export interface InventoryBatchDocument extends IInventoryBatch, Document {}

const InventoryBatchSchema = new Schema<InventoryBatchDocument>(
  {
    farmerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Farmer ID is required"],
      index: true,
    },
    category: {
      type: String,
      enum: ["fresh", "sprouted", "rotten"] as OnionCategory[],
      required: [true, "Category is required"],
      index: true,
    },
    quantityKg: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.1, "Quantity must be at least 0.1 kg"],
    },
    pricePerKg: {
      type: Number,
      required: [true, "Price per kg is required"],
      min: [0, "Price cannot be negative"],
    },
    intakeDate: {
      type: Date,
      required: [true, "Intake date is required"],
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["available", "reserved", "sold", "expired"] as BatchStatus[],
      default: "available",
      index: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      index: true,
    },
    harvestDate: {
      type: Date,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ─── Automatic classification hook ─────────────────────────────────────────────
InventoryBatchSchema.pre<InventoryBatchDocument>("save", async function () {
  if (this.status === "sold") {
    return;
  }

  // Respect manual override if category is updated to sprouted or rotten
  if (this.isModified("category") && (this.category === "sprouted" || this.category === "rotten")) {
    if (this.category === "rotten") {
      this.status = "expired";
    }
    return;
  }

  const now = new Date();
  const intake = this.intakeDate || now;
  const daysSinceIntake = (now.getTime() - intake.getTime()) / (1000 * 60 * 60 * 24);

  if (this.status === "expired" || daysSinceIntake > 60) {
    this.category = "rotten";
    this.status = "expired";
  } else if (this.harvestDate) {
    const daysSinceHarvest = (now.getTime() - this.harvestDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceHarvest > 30 && this.category !== "rotten") {
      this.category = "sprouted";
    }
  }
});

// ─── Compound index for common queries ────────────────────────────────────────
InventoryBatchSchema.index({ category: 1, status: 1 });
InventoryBatchSchema.index({ farmerId: 1, status: 1 });
InventoryBatchSchema.index({ createdAt: -1 });

const InventoryBatch: Model<InventoryBatchDocument> =
  mongoose.model<InventoryBatchDocument>("InventoryBatch", InventoryBatchSchema);

export default InventoryBatch;
