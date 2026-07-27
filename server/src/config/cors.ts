import { CorsOptions } from "cors";
import { env } from "./env";

/**
 * Parses CLIENT_URL (a comma-separated list of origins) into a deduplicated
 * array of trimmed origin strings.
 *
 * Always includes localhost variants so local development never breaks,
 * even if they are omitted from the environment variable.
 *
 * Examples of valid CLIENT_URL values:
 *   "http://localhost:5173"
 *   "http://localhost:5173,https://agroloop.vercel.app"
 *   "http://localhost:5173,https://agroloop.vercel.app,https://agroloop-git-main-yourteam.vercel.app"
 */
const LOCALHOST_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

export const getAllowedOrigins = (): string[] => {
  const fromEnv = env.CLIENT_URL
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  // Merge env origins with localhost fallbacks, removing duplicates.
  const merged = Array.from(new Set([...fromEnv, ...LOCALHOST_ORIGINS]));
  return merged;
};

/**
 * CORS origin callback for both Express cors() middleware and Socket.IO.
 *
 * - Allows requests with no Origin header (Postman, mobile apps, curl,
 *   server-to-server calls) — `origin` is undefined in that case.
 * - Allows any origin present in the allowedOrigins list.
 * - Rejects everything else with a meaningful error string (not thrown,
 *   passed to the callback so Express/Socket.IO handle the 403 response).
 */
export const corsOriginCallback = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void => {
  // No Origin header → allow (Postman, server-to-server, mobile native)
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) {
    callback(null, true);
  } else {
    callback(
      new Error(
        `CORS: Origin '${origin}' is not allowed. ` +
          `Add it to CLIENT_URL in your environment variables.`
      )
    );
  }
};

/**
 * Shared Express CorsOptions object.
 * Import this wherever you call cors() to avoid duplicating configuration.
 */
export const corsOptions: CorsOptions = {
  origin: corsOriginCallback,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
