/**
 * upload.middleware.ts — Multer configuration for image uploads.
 *
 * Uses memoryStorage so the file buffer is available in `req.file.buffer`
 * and can be streamed directly to Cloudinary without touching the disk.
 *
 * Constraints enforced here (before the controller runs):
 *   - Max file size: 5 MB
 *   - Allowed MIME types: image/jpeg, image/png, image/webp
 *
 * A second content-based MIME check is performed in the upload controller
 * using the file magic bytes — this defends against clients that spoof the
 * Content-Type header.
 */
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { ApiError } from "../utils/ApiError";

// ─── Constants ────────────────────────────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// ─── MIME type filter ─────────────────────────────────────────────────────────
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(
      ApiError.badRequest(
        `Invalid file type "${file.mimetype}". Only JPEG, PNG, and WebP images are allowed.`
      ) as unknown as null,
      false
    );
    return;
  }
  cb(null, true);
};

// ─── Multer instance ──────────────────────────────────────────────────────────
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // only one image per request
  },
  fileFilter,
});

/**
 * Express middleware for single image upload.
 * Attaches the uploaded file to req.file.
 * Field name: "image"
 */
export const uploadSingle = uploadMiddleware.single("image");
