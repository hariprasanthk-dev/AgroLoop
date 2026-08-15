/**
 * rateLimiter.middleware.ts
 *
 * Three tiers of rate limiting applied per-route in app.ts:
 *   authLimiter    — 10 req / 15 min  (brute-force / credential-stuffing)
 *   paymentLimiter — 20 req / 15 min  (payment fraud)
 *   apiLimiter     — 100 req / 15 min (general API abuse)
 *
 * Store strategy (automatic fallback — no Redis required for local dev):
 *   - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Upstash REST store
 *   - REDIS_URL                                         → ioredis store
 *   - Neither                                           → in-memory store (default)
 *
 * The in-memory store is perfectly adequate for a single-process deployment.
 * Switch to Redis when running multiple replicas so counters are shared.
 *
 * How to enable Redis:
 *   # Upstash (recommended — free tier at console.upstash.com)
 *   UPSTASH_REDIS_REST_URL=https://<name>.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=<token>
 *
 *   # Standard Redis (self-hosted / Redis Cloud)
 *   REDIS_URL=redis://:<password>@<host>:<port>
 */
import rateLimit, { Options as RateLimitOptions } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "../config/redis";
import { logger } from "../config/logger";

// ─── Shared settings ──────────────────────────────────────────────────────────
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In development, use very high limits so local testing is never blocked.
// All production limits remain enforced when NODE_ENV !== "development".
const isDev = process.env.NODE_ENV === "development";

const limitMessage = (msg: string) => ({ success: false, message: msg });

// ─── In-memory limiter factory (used immediately at module load) ──────────────
const makeMemoryLimiter = (overrides: Partial<RateLimitOptions>) =>
  rateLimit({
    windowMs: WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: 429,
    // Skip ALL rate limiting in development — never blocks local testing.
    skip: isDev ? () => true : undefined,
    ...overrides,
  });

// ─── Limiter instances (start with in-memory store) ──────────────────────────
export const authLimiter = makeMemoryLimiter({
  max: 10,
  skipSuccessfulRequests: false,
  message: limitMessage(
    "Too many authentication attempts. Please try again after 15 minutes."
  ),
});

export const apiLimiter = makeMemoryLimiter({
  max: 100,
  message: limitMessage("Too many requests. Please try again after 15 minutes."),
});

export const paymentLimiter = makeMemoryLimiter({
  max: 20,
  message: limitMessage(
    "Too many payment requests. Please try again after 15 minutes."
  ),
});

// ─── Redis store wiring (non-blocking, best-effort) ───────────────────────────
// Runs asynchronously after module load.  If Redis is available, all three
// limiters are upgraded to share a single RedisStore.  If it fails or is not
// configured, the in-memory store remains in use — no requests are blocked.
(async () => {
  try {
    const client = await getRedisClient();
    if (!client) return; // in-memory mode — nothing to upgrade

    const redisStore = new RedisStore({
      // rate-limit-redis expects Promise<RedisReply>; our wrapper returns
      // Promise<unknown> which is compatible at runtime. The cast is safe.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (command: string, ...args: string[]) =>
        client.sendCommand(command, ...args) as any, // eslint-disable-line
      prefix: "rl:",
    });

    for (const limiter of [authLimiter, apiLimiter, paymentLimiter]) {
      // The store property is publicly typed as read-only in some versions but
      // is actually writable at runtime. The cast silences the TS error.
      (limiter as unknown as { store: RedisStore }).store = redisStore;
    }

    logger.info("✅ Rate limiters: Redis store attached");
  } catch (err) {
    logger.warn(
      { err },
      "⚠️  Redis store wiring failed — rate limiters continue with in-memory store"
    );
  }
})();
