import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

let isConnected = false;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async (attempt = 1): Promise<void> => {
  if (isConnected) {
    logger.debug("Using existing MongoDB connection");
    return;
  }

  try {
    logger.info(
      { attempt, maxRetries: MAX_RETRIES },
      "Connecting to MongoDB Atlas..."
    );
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,  // Fail fast: 5s instead of 10s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      // Don't buffer commands when disconnected — fail immediately
      // so users get an error right away instead of a 10s hang
      bufferCommands: false,
    });

    isConnected = true;
    logger.info({ host: conn.connection.host }, "✅ MongoDB connected");

    // Ensure all existing user documents are marked as email verified
    try {
      const User = mongoose.model("User");
      await User.updateMany(
        { $or: [{ isEmailVerified: { $exists: false } }, { isEmailVerified: false }] },
        { $set: { isEmailVerified: true } }
      );
    } catch {
      // Ignore if model not registered yet
    }

    mongoose.connection.on("error", (err) => {
      logger.error({ err }, "❌ MongoDB connection error");
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️  MongoDB disconnected — Mongoose will attempt to reconnect");
      isConnected = false;
    });
  } catch (error) {
    const err = error as Error;
    logger.error(
      { attempt, maxRetries: MAX_RETRIES, err: err.message },
      "❌ MongoDB connection attempt failed"
    );

    // Check if it is an IP whitelist error
    if (err.message && err.message.includes("IP")) {
      logger.error(
        "MongoDB Atlas IP not whitelisted. " +
        "Go to https://cloud.mongodb.com → Network Access → Add IP Address."
      );
    }

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt;
      logger.info({ delaySeconds: delay / 1000 }, "⏳ Retrying MongoDB connection...");
      await sleep(delay);
      return connectDB(attempt + 1);
    }

    logger.fatal(
      { maxRetries: MAX_RETRIES },
      "❌ All MongoDB connection attempts failed. Exiting."
    );
    process.exit(1);
  }
};
