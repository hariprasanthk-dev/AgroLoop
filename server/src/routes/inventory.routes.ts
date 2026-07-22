import { Router } from "express";
import * as InventoryController from "../controllers/inventory.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import {
  createInventoryValidator,
  updateInventoryValidator,
} from "../validators/inventory.validator";

const router = Router();

// All inventory routes require authentication
router.use(authenticate);

// GET /api/inventory — all authenticated users can list
router.get("/", InventoryController.listBatches);

// GET /api/inventory/stats — farmers get their own stats; admin gets global
router.get("/stats", authorize("farmer", "admin"), InventoryController.getStats);

// GET /api/inventory/:id — all authenticated users
router.get("/:id", InventoryController.getBatch);

// POST /api/inventory — farmers only
router.post(
  "/",
  authorize("farmer"),
  createInventoryValidator,
  InventoryController.createBatch
);

// PUT /api/inventory/:id — farmer (own) or admin
router.put(
  "/:id",
  authorize("farmer", "admin"),
  updateInventoryValidator,
  InventoryController.updateBatch
);

// DELETE /api/inventory/:id — farmer (own) or admin; ownership enforced in service
router.delete(
  "/:id",
  authorize("farmer", "admin"),
  InventoryController.deleteBatch
);

export default router;
