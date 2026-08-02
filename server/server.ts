/**
 * server.ts — Application entry point.
 *
 * ⚠️  IMPORTANT: initSentry() MUST be called before any other import so that
 * Sentry's auto-instrumentation hooks into all modules correctly.
 */
import { initSentry } from "./src/config/sentry";
initSentry();

import http from "http";
import app from "./src/app";
import { connectDB } from "./src/config/db";
import { initSocket } from "./src/socket/socket";
import { env } from "./src/config/env";
import { logger } from "./src/config/logger";

const PORT = parseInt(env.PORT, 10);

const startServer = async () => {
  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  initSocket(httpServer);

  // ─── Bind HTTP port FIRST so the server is reachable immediately ────────────
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      logger.info(
        { port: PORT, env: env.NODE_ENV, url: `http://localhost:${PORT}` },
        "✅ AgroLoop API Server running"
      );
      resolve();
    });
  });

  // ─── Connect to MongoDB (with retry) after port is bound ────────────────────
  await connectDB();

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutdown signal received — closing gracefully");
    httpServer.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "❌ Unhandled Promise Rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "❌ Uncaught Exception");
    process.exit(1);
  });
};

startServer();
