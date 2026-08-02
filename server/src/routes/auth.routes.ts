import { Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from "../validators/auth.validator";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// ─── Existing routes ──────────────────────────────────────────────────────────

// POST /api/auth/register
router.post("/register", registerValidator, AuthController.register);

// POST /api/auth/login
router.post("/login", loginValidator, AuthController.login);

// GET /api/auth/me
router.get("/me", authenticate, AuthController.getMe);

// ─── Email verification ───────────────────────────────────────────────────────

// POST /api/auth/send-verification  (authenticated — must be logged in to resend)
router.post("/send-verification", authenticate, AuthController.sendVerification);

// GET /api/auth/verify-email?token=<raw-token>  (public — clicked from email link)
router.get("/verify-email", verifyEmailValidator, AuthController.verifyEmail);

// ─── Password reset ───────────────────────────────────────────────────────────

// POST /api/auth/forgot-password  (public)
router.post("/forgot-password", forgotPasswordValidator, AuthController.forgotPassword);

// POST /api/auth/reset-password  (public)
router.post("/reset-password", resetPasswordValidator, AuthController.resetPassword);

export default router;
