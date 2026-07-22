import { Router } from "express";
import * as UserController from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";

const router = Router();

// All user management routes are admin-only
router.use(authenticate, authorize("admin"));

// GET /api/users
router.get("/", UserController.getAllUsers);

// GET /api/users/:id
router.get("/:id", UserController.getUserById);

// DELETE /api/users/:id
router.delete("/:id", UserController.deleteUser);

// PATCH /api/users/:id/role
router.patch("/:id/role", UserController.updateUserRole);

export default router;
