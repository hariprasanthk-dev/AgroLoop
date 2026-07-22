import { Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import { registerValidator, loginValidator } from "../validators/auth.validator";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// POST /api/auth/register
router.post("/register", registerValidator, AuthController.register);

// POST /api/auth/login
router.post("/login", loginValidator, AuthController.login);

// GET /api/auth/me
router.get("/me", authenticate, AuthController.getMe);

export default router;
