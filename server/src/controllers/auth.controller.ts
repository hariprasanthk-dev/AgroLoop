import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import * as AuthService from "../services/auth.service";
import { AuthenticatedRequest } from "../types";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  const result = await AuthService.registerUser({ name, email, password, role });
  return ApiResponse.created(res, "Account created successfully", result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await AuthService.loginUser({ email, password });
  return ApiResponse.ok(res, "Login successful", result);
});

export const getMe = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await AuthService.getCurrentUser(req.user!.id);
    return ApiResponse.ok(res, "User fetched successfully", user);
  }
);
