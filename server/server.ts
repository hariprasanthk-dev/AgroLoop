import http from "http";
import app from "./src/app";
import { connectDB } from "./src/config/db";
import { initSocket } from "./src/socket/socket";
import { env } from "./src/config/env";

const PORT = parseInt(env.PORT, 10);

const startServer = async () => {
  // Create HTTP server from Express app
  const httpServer = http.createServer(app);

  // Initialize Socket.IO
  initSocket(httpServer);

  // ─── Bind HTTP port FIRST so the server is reachable immediately ────────────
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      console.log(`
  ╔══════════════════════════════════════════╗
  ║           AgroLoop API Server            ║
  ╠══════════════════════════════════════════╣
  ║  Status   : Running                      ║
  ║  Port     : ${PORT}                           ║
  ║  Env      : ${env.NODE_ENV.padEnd(28)}  ║
  ║  URL      : http://localhost:${PORT}           ║
  ╚══════════════════════════════════════════╝
      `);
      resolve();
    });
  });

  // ─── Connect to MongoDB (with retry) after port is bound ────────────────────
  await connectDB();

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
    httpServer.close(() => {
      console.log("✅ HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Promise Rejection:", reason);
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    process.exit(1);
  });
};

startServer();
