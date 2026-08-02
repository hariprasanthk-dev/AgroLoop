/**
 * upload.routes.ts
 *
 * POST /api/upload/image
 *   - Requires authentication (Bearer JWT)
 *   - Only farmers and admins can upload inventory images
 *   - Multer parses the multipart body and enforces 5 MB + MIME type limits
 *   - The uploadImage controller streams the validated buffer to Cloudinary
 */
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { uploadSingle } from "../middleware/upload.middleware";
import { uploadImage } from "../controllers/upload.controller";
import { ApiError } from "../utils/ApiError";

const router = Router();

/**
 * Wrap Multer's middleware to convert its error types into ApiErrors.
 * Multer throws its own error class, not ApiError, so without this adapter
 * the global error handler would return a 500 instead of a 400.
 */
const multerErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  uploadSingle(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(ApiError.badRequest("File too large. Maximum allowed size is 5 MB."));
      } else {
        next(ApiError.badRequest(`Upload error: ${err.message}`));
      }
      return;
    }

    // Non-Multer errors (e.g., our fileFilter ApiError) — pass through
    next(err);
  });
};

// POST /api/upload/image
router.post(
  "/image",
  authenticate,
  authorize("farmer", "admin"),
  multerErrorHandler,
  uploadImage
);

export default router;
