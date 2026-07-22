import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import Notification from "../models/Notification.model";
import { AuthenticatedRequest } from "../types";

export const getNotifications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const query = req.query as Record<string, string>;
    const { page = "1", limit = "20" } = query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user!.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments({ userId: req.user!.id }),
      Notification.countDocuments({ userId: req.user!.id, isRead: false }),
    ]);

    return ApiResponse.ok(
      res,
      "Notifications fetched",
      { notifications, unreadCount },
      {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      }
    );
  }
);

export const markAsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const notification = await Notification.findOne({
      _id: String(req.params.id),
      userId: req.user!.id,
    });

    if (!notification) throw ApiError.notFound("Notification not found");

    notification.isRead = true;
    await notification.save();

    return ApiResponse.ok(res, "Notification marked as read", notification);
  }
);

export const markAllAsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    await Notification.updateMany(
      { userId: req.user!.id, isRead: false },
      { isRead: true }
    );
    return ApiResponse.ok(res, "All notifications marked as read");
  }
);

export const deleteNotification = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const notification = await Notification.findOneAndDelete({
      _id: String(req.params.id),
      userId: req.user!.id,
    });
    if (!notification) throw ApiError.notFound("Notification not found");
    return ApiResponse.ok(res, "Notification deleted");
  }
);
