import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import User from "../models/User.model";
import { AuthenticatedRequest } from "../types";

export const getAllUsers = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const users = await User.find({}).sort({ createdAt: -1 });
    return ApiResponse.ok(res, "Users fetched", users);
  }
);

export const getUserById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findById(String(req.params.id));
    if (!user) throw ApiError.notFound("User not found");
    return ApiResponse.ok(res, "User fetched", user);
  }
);

export const deleteUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await User.findByIdAndDelete(String(req.params.id));
    if (!user) throw ApiError.notFound("User not found");
    return ApiResponse.ok(res, "User deleted successfully");
  }
);

export const updateUserRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { role } = req.body as { role: string };
    const user = await User.findByIdAndUpdate(
      String(req.params.id),
      { role },
      { new: true, runValidators: true }
    );
    if (!user) throw ApiError.notFound("User not found");
    return ApiResponse.ok(res, "User role updated", user);
  }
);
