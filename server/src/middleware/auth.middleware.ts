import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { AuthenticatedRequest, JwtPayload } from "../types";
import User from "../models/User.model";

/**
 * Verifies the JWT from the Authorization header and attaches
 * the decoded user payload to req.user.
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw ApiError.unauthorized("No token provided");
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Verify user still exists in DB
    const userExists = await User.findById(decoded.id).select("_id role email");
    if (!userExists) {
      throw ApiError.unauthorized("User no longer exists");
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized("Invalid token"));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized("Token expired"));
    } else {
      next(error);
    }
  }
};
