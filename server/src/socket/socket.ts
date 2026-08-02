import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { JwtPayload } from "../types";
import { corsOriginCallback } from "../config/cors";
import { logger } from "../config/logger";

let io: Server;

export const initSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      // Reuses the same allowlist logic as Express CORS — no duplicated config.
      origin: corsOriginCallback,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // ─── JWT Middleware for Socket Connections ──────────────────────────────────
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication token missing"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).user = decoded;
      next();
    } catch {
      next(new Error("Invalid authentication token"));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on("connection", (socket: Socket) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (socket as any).user as JwtPayload;

    logger.info(
      { socketId: socket.id, userId: user?.id, role: user?.role },
      "🔌 Socket connected"
    );

    // Join user's private room for targeted notifications
    if (user?.id) {
      socket.join(`user:${user.id}`);
    }

    // Join broadcast room so all users receive inventory refresh events
    socket.join("broadcast:inventory");

    // ─── Client Events ───────────────────────────────────────────────────────
    socket.on("join:order", (orderId: string) => {
      socket.join(`order:${orderId}`);
      logger.debug(
        { socketId: socket.id, orderId },
        "📦 Socket joined order room"
      );
    });

    socket.on("leave:order", (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info(
        { socketId: socket.id, reason },
        "🔌 Socket disconnected"
      );
    });

    socket.on("error", (error) => {
      logger.error(
        { socketId: socket.id, err: error },
        "Socket error"
      );
    });
  });

  logger.info("✅ Socket.IO initialized");
  return io;
};

/**
 * Returns the initialized Socket.IO instance.
 * Throws if called before initSocket().
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initSocket() first.");
  }
  return io;
};
