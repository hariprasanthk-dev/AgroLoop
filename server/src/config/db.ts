import mongoose from "mongoose";
import { env } from "./env";

let isConnected = false;

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async (attempt = 1): Promise<void> => {
  if (isConnected) {
    console.log("✅ Using existing MongoDB connection");
    return;
  }

  try {
    console.log(
      `🔄 Connecting to MongoDB Atlas... (attempt ${attempt}/${MAX_RETRIES})`
    );
    const conn = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected. Reconnecting...");
      isConnected = false;
    });
  } catch (error) {
    const err = error as Error;
    console.error(`❌ MongoDB connection attempt ${attempt} failed:`, err.message);

    // Check if it is an IP whitelist error
    if (err.message && err.message.includes("IP")) {
      console.error(`
╔══════════════════════════════════════════════════════════╗
║           MONGODB ATLAS — IP NOT WHITELISTED             ║
╠══════════════════════════════════════════════════════════╣
║  Your current IP address is not allowed to connect.      ║
║  Fix:                                                    ║
║  1. Go to https://cloud.mongodb.com                      ║
║  2. Select your cluster → Network Access                 ║
║  3. Click "Add IP Address"                               ║
║  4. Add your current IP  (or 0.0.0.0/0 for dev only)    ║
╚══════════════════════════════════════════════════════════╝
      `);
    }

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * attempt;
      console.log(`⏳ Retrying in ${delay / 1000}s...`);
      await sleep(delay);
      return connectDB(attempt + 1);
    }

    console.error(`❌ All ${MAX_RETRIES} MongoDB connection attempts failed. Exiting.`);
    process.exit(1);
  }
};
