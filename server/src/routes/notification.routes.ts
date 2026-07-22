import { Router } from "express";
import * as NotificationController from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

// GET /api/notifications
router.get("/", NotificationController.getNotifications);

// PATCH /api/notifications/read-all
router.patch("/read-all", NotificationController.markAllAsRead);

// PATCH /api/notifications/:id/read
router.patch("/:id/read", NotificationController.markAsRead);

// DELETE /api/notifications/:id
router.delete("/:id", NotificationController.deleteNotification);

export default router;
