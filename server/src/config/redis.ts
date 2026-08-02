/**
 * redis.ts — Optional Redis client for rate-limit store.
 *
 * Supports two Redis providers (in priority order):
 *   1. Upstash REST API  — add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *   2. Standard Redis    — add REDIS_URL (redis:// or rediss://)
 *
 * If neither is configured the module exports `null` and the rate limiters
 * fall back to the in-memory store — identical behaviour to the original code.
 * No crashes, no configuration required for local development.
 *
 * To enable, add ONE of these to your .env / hosting dashboard:
 *
 *   # Upstash (recommended for serverless / Render free tier)
 *   UPSTASH_REDIS_REST_URL=https://<name>.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=<token>
 *
 *   # Standard Redis (self-hosted or Redis Cloud)
 *   REDIS_URL=redis://:<password>@<host>:<port>
 */
import { logger } from "./logger";

/**
 * A minimal interface that satisfies rate-limit-redis's `sendCommand` requirement.
 * Both ioredis and the Upstash wrapper implement this shape.
 */
export interface RateLimitRedisClient {
  sendCommand(command: string, ...args: string[]): Promise<unknown>;
}

let _client: RateLimitRedisClient | null = null;
let _initialized = false;

export const getRedisClient = async (): Promise<RateLimitRedisClient | null> => {
  if (_initialized) return _client;
  _initialized = true;

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  // ── 1. Upstash REST ─────────────────────────────────────────────────────────
  if (upstashUrl && upstashToken) {
    try {
      /**
       * We call the Upstash Redis HTTP API directly via fetch so we don't need
       * to install @upstash/redis as a dependency. This keeps the package
       * footprint minimal and avoids import gymnastics.
       *
       * Protocol: POST https://<host>/pipeline with JSON body
       * [["CMD", "arg1", "arg2", ...]]
       */
      const upstashClient: RateLimitRedisClient = {
        sendCommand: async (command: string, ...args: string[]): Promise<unknown> => {
          const url = `${upstashUrl}/pipeline`;
          const body = JSON.stringify([[command, ...args]]);
          const res = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${upstashToken}`,
              "Content-Type": "application/json",
            },
            body,
          });
          if (!res.ok) {
            throw new Error(`Upstash Redis error: ${res.status} ${res.statusText}`);
          }
          const json = (await res.json()) as Array<{ result: unknown; error?: string }>;
          if (json[0]?.error) throw new Error(json[0].error);
          return json[0]?.result;
        },
      };

      // Ping to verify credentials before accepting the client.
      await upstashClient.sendCommand("PING");
      _client = upstashClient;
      logger.info("✅ Redis rate-limit store: Upstash connected");
      return _client;
    } catch (err) {
      logger.warn(
        { err },
        "⚠️  Upstash Redis unavailable — falling back to in-memory rate-limit store"
      );
      _client = null;
      return null;
    }
  }

  // ── 2. Standard Redis (ioredis) ─────────────────────────────────────────────
  if (redisUrl) {
    try {
      // Dynamic import so ioredis is only required when REDIS_URL is set.
      // If it's not installed the catch block handles the error gracefully.
      type IoRedis = {
        default: new (url: string) => {
          call(command: string, ...args: string[]): Promise<unknown>;
        };
      };
      const { default: Redis } = (await import("ioredis" as string)) as IoRedis;
      const ioredisInstance = new Redis(redisUrl);

      const ioredisClient: RateLimitRedisClient = {
        sendCommand: (command: string, ...args: string[]) =>
          ioredisInstance.call(command, ...args),
      };

      await ioredisClient.sendCommand("PING");
      _client = ioredisClient;
      logger.info("✅ Redis rate-limit store: ioredis connected");
      return _client;
    } catch (err) {
      logger.warn(
        { err },
        "⚠️  ioredis unavailable — falling back to in-memory rate-limit store"
      );
      _client = null;
      return null;
    }
  }

  // ── 3. No Redis configured ──────────────────────────────────────────────────
  logger.info(
    "ℹ️  No Redis configured (REDIS_URL / UPSTASH_REDIS_REST_URL) — " +
    "rate limiters using in-memory store"
  );
  return null;
};
