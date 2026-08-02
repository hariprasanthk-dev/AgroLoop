/**
 * upload.controller.ts — Image upload to Cloudinary.
 *
 * Flow:
 *   1. Multer has already validated MIME type and size, and loaded the file
 *      into memory (req.file.buffer).
 *   2. This controller performs a second magic-byte MIME validation for
 *      defense-in-depth against spoofed Content-Type headers.
 *   3. The buffer is streamed to Cloudinary via upload_stream.
 *   4. Returns { url, publicId } — the URL is stored as imageUrl in the
 *      inventory batch after the client completes the inventory form.
 */
import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { AuthenticatedRequest } from "../types";
import { getCloudinary } from "../config/cloudinary";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../middleware/upload.middleware";
import { logger } from "../config/logger";

// ─── Magic byte signatures (first bytes of file) ─────────────────────────────
// Provides defense against MIME type spoofing — checks the actual file content
// rather than relying on the browser-reported Content-Type.
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png",  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // "RIFF"
];

const verifyMagicBytes = (buffer: Buffer): boolean => {
  for (const sig of MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    const match = sig.bytes.every((b, i) => buffer[offset + i] === b);

    // WebP additionally needs "WEBP" at bytes 8-11
    if (match && sig.mime === "image/webp") {
      const webp = [0x57, 0x45, 0x42, 0x50];
      const webpMatch = webp.every((b, i) => buffer[8 + i] === b);
      if (webpMatch) return true;
      continue;
    }
    if (match) return true;
  }
  return false;
};

// ─── Controller ───────────────────────────────────────────────────────────────

export interface UploadResult {
  url: string;
  publicId: string;
}

export const uploadImage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    // req.file is populated by the uploadSingle middleware
    if (!req.file) {
      throw ApiError.badRequest("No image file provided. Send a file in the \"image\" field.");
    }

    const { buffer, mimetype, size } = req.file;

    // Double-check size (Multer already enforces this, but belt-and-suspenders)
    if (size > MAX_FILE_SIZE_BYTES) {
      throw ApiError.badRequest(
        `File too large (${(size / 1024 / 1024).toFixed(2)} MB). Maximum allowed size is 5 MB.`
      );
    }

    // Double-check MIME type
    if (!ALLOWED_MIME_TYPES.has(mimetype)) {
      throw ApiError.badRequest(
        "Invalid file type. Only JPEG, PNG, and WebP images are accepted."
      );
    }

    // Magic byte verification — catches MIME spoofing
    if (!verifyMagicBytes(buffer)) {
      throw ApiError.badRequest(
        "File content does not match its declared type. Upload a valid JPEG, PNG, or WebP image."
      );
    }

    const cloudinary = getCloudinary();

    // Stream buffer to Cloudinary
    const result = await new Promise<UploadResult>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "agroloop/inventory",
          resource_type: "image",
          // Automatically determine format from file content
          format: undefined,
          // Transformations: limit width, auto quality, strip EXIF metadata
          transformation: [
            { width: 1200, crop: "limit" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
          // Attach uploader info as metadata (useful for auditing)
          context: {
            uploaded_by: req.user!.id,
            role: req.user!.role,
          },
        },
        (error, result) => {
          if (error || !result) {
            logger.error({ error }, "Cloudinary upload failed");
            reject(ApiError.internal("Image upload failed. Please try again."));
          } else {
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          }
        }
      );

      stream.end(buffer);
    });

    logger.info(
      { publicId: result.publicId, userId: req.user!.id },
      "Image uploaded to Cloudinary"
    );

    return ApiResponse.ok(res, "Image uploaded successfully", result);
  }
);
