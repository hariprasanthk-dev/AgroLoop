/**
 * One-off migration: rename the legacy order status "packed" to "packaged".
 *
 * The API already treats "packed" as "packaged" when reading, so running this
 * is not required for correctness — it just cleans the stored data.
 *
 *   npm run migrate:order-status
 *
 * Safe to run more than once.
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import Order from "../models/Order.model";

const run = async () => {
  await mongoose.connect(env.MONGO_URI);
  // "packed" is no longer part of the OrderStatus type, so type the filter loosely.
  const legacyFilter: Record<string, unknown> = { orderStatus: "packed" };
  const result = await Order.updateMany(
    legacyFilter,
    { $set: { orderStatus: "packaged" } }
  );
  console.log(`Updated ${result.modifiedCount} order(s) from "packed" to "packaged".`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
