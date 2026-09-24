import { Types } from "mongoose";
import Notification, { NotificationDocument } from "../models/Notification.model";
import { NotificationType } from "../types";
import { getIO } from "../socket/socket";
import { logger } from "../config/logger";

type Id = string | Types.ObjectId;

interface NotifyPayload {
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: Id;
}

/** Short, human-readable order reference used in notification text and the UI. */
export const formatOrderRef = (orderId: Id): string =>
  `#ORD-${String(orderId).slice(-6).toUpperCase()}`;

const emitToUser = (userId: Id, event: string, payload: unknown): void => {
  try {
    getIO().to(`user:${String(userId)}`).emit(event, payload);
  } catch {
    // Socket.IO is not initialised in some contexts (tests, scripts). The
    // notification is already persisted, so clients will still see it.
  }
};

/**
 * Persists a notification and pushes the saved document to the user's socket
 * room. The emitted payload is the stored document, so its `_id` is real and
 * can be marked read / deleted through the REST API.
 */
export const notify = async (
  userId: Id,
  payload: NotifyPayload
): Promise<NotificationDocument | null> => {
  try {
    const notification = await Notification.create({ userId, ...payload });
    emitToUser(userId, "notification:new", notification.toJSON());
    return notification;
  } catch (err) {
    // A failed notification must never roll back the business operation that
    // triggered it, but it should be visible in the logs.
    logger.error({ err, userId, type: payload.type }, "Failed to create notification");
    return null;
  }
};

/**
 * Tells the given users that an order changed. Clients react by re-fetching
 * the order from the API — the event itself carries no status, so the
 * database stays the single source of truth.
 */
export const emitOrderUpdated = (orderId: Id, userIds: Id[]): void => {
  const payload = { orderId: String(orderId) };
  for (const userId of new Set(userIds.map(String))) {
    emitToUser(userId, "order:updated", payload);
  }
};
