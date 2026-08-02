import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import * as AuthService from "../services/auth.service";
import { AuthenticatedRequest } from "../types";

// ─── Existing handlers ────────────────────────────────────────────────────────

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  const result = await AuthService.registerUser({ name, email, password, role });
  return ApiResponse.created(res, "Account created successfully. Please check your email to verify your account.", result);
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

// ─── Email verification ───────────────────────────────────────────────────────

/**
 * POST /api/auth/send-verification
 * Resends the verification email. Requires authentication (user must be logged in).
 */
export const sendVerification = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await AuthService.resendVerificationEmail(req.user!.id);
    return ApiResponse.ok(
      res,
      "Verification email sent. Please check your inbox."
    );
  }
);

/**
 * GET /api/auth/verify-email?token=<raw-token>
 * Verifies the user's email address. Public — no auth header needed.
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };
  if (!token) {
    // Return a redirect-friendly JSON error the frontend can handle
    return ApiResponse.ok(res, "error", { verified: false, error: "Token is required" });
  }
  await AuthService.verifyEmail(token);
  return ApiResponse.ok(res, "Email verified successfully!", { verified: true });
});

// ─── Password reset ───────────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * Accepts an email and sends a reset link if the account exists.
 * Always returns 200 to prevent email enumeration.
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  await AuthService.requestPasswordReset(email);
  // Always return the same message regardless of whether the email exists
  return ApiResponse.ok(
    res,
    "If an account with that email exists, a password reset link has been sent."
  );
});

/**
 * POST /api/auth/reset-password
 * Accepts the raw token (from URL) and new password. Resets the password.
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;
  await AuthService.resetPassword(token, password);
  return ApiResponse.ok(
    res,
    "Password reset successfully. You can now log in with your new password."
  );
});
