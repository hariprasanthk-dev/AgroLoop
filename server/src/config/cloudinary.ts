/**
 * cloudinary.ts — Cloudinary SDK singleton.
 *
 * The SDK is configured lazily once per process lifetime.
 * If credentials are absent, a warning is emitted and upload attempts
 * will throw an ApiError — the rest of the app keeps running normally.
 *
 * Required environment variables:
 *   CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   CLOUDINARY_API_KEY=your_api_key
 *   CLOUDINARY_API_SECRET=your_api_secret
 *
 * Get credentials at https://cloudinary.com → Dashboard → API Keys.
 * The free tier includes 25 GB storage and 25 GB bandwidth per month.
 */
import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";
import { logger } from "./logger";

let _configured = false;

export const getCloudinary = () => {
  if (_configured) return cloudinary;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    if (env.NODE_ENV !== "test") {
      logger.warn(
        "⚠️  Cloudinary not configured (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / " +
        "CLOUDINARY_API_SECRET missing) — image uploads will fail."
      );
    }
    return cloudinary; // return anyway; upload will throw when credentials are invalid
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true, // always use https URLs
  });

  _configured = true;
  logger.info("✅ Cloudinary configured");
  return cloudinary;
};

export { cloudinary };
