import { Request, Response, NextFunction } from "express";
import { xss } from "express-xss-sanitizer";

// ─── NoSQL Injection Sanitizer ────────────────────────────────────────────────
/**
 * Recursively strips any object key that starts with "$" from a value.
 *
 * WHY a custom implementation instead of express-mongo-sanitize:
 *   - express-mongo-sanitize is abandoned and crashes on Express 5 because
 *     Express 5 made req.query a read-only getter — assigning to it throws a
 *     TypeError at runtime.
 *   - This project already uses express-validator (isMongoId, isIn enums) and
 *     Mongoose strict schemas, which together close most of the NoSQL injection
 *     surface.  A targeted body-only key-stripper is sufficient and safe.
 *
 * WHAT it blocks (examples):
 *   { "email": { "$gt": "" } }           → { "email": {} }
 *   { "password": { "$ne": null } }      → { "password": {} }
 *   { "role": { "$where": "1==1" } }     → { "role": {} }
 */
const stripDollarKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripDollarKeys);
  }
  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (!key.startsWith("$")) {
        sanitized[key] = stripDollarKeys(val);
      }
      // Keys starting with "$" are silently dropped
    }
    return sanitized;
  }
  return value;
};

/**
 * Express middleware that sanitizes req.body against NoSQL operator injection.
 * Only req.body is mutated — req.query is intentionally left untouched because
 * Express 5 makes req.query read-only (assigning to it throws a TypeError).
 * Query-string parameters are already protected by express-validator rules in
 * every route that reads from req.query.
 */
export const noSqlSanitizer = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body === "object") {
    req.body = stripDollarKeys(req.body);
  }
  next();
};

// ─── XSS Sanitizer ───────────────────────────────────────────────────────────
/**
 * Re-export the xss() middleware from express-xss-sanitizer (v2.0.2+).
 *
 * WHY express-xss-sanitizer instead of xss-clean:
 *   - xss-clean is deprecated and unmaintained.
 *   - express-xss-sanitizer is actively maintained, supports Express 4 & 5,
 *     ships its own TypeScript types, and patches CVE-2026-33979 in v2.0.2.
 *
 * WHAT it blocks (examples):
 *   req.body.name = '<script>alert("XSS")</script>'
 *     → '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 *
 *   req.body.description = '<img src=x onerror=alert(1)>'
 *     → '&lt;img src=x onerror=alert(1)&gt;'
 *
 * It sanitizes req.body, req.query (read-safe — it reads but does not assign
 * back to req.query), and req.params in one pass.
 */
export const xssSanitizer = xss();
