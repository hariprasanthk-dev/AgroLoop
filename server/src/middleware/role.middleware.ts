import { Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { AuthenticatedRequest, UserRole } from "../types";

/**
 * Role-based authorization guard factory.
 * Usage: authorize("admin") or authorize("farmer", "admin")
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
