import { Router } from "express";
import * as AdminController from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// All routes require authentication and admin privileges
router.use(authenticate, authorize("admin"));

// GET /api/admin/stats
router.get("/stats", AdminController.getDashboardStats);

export default router;
