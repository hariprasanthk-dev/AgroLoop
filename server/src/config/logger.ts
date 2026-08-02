/**
 * logger.ts — Centralised Pino logger instance.
 *
 * Usage:
 *   import { logger } from './config/logger';
 *   logger.info('Server started');
 *   logger.error({ err }, 'Something went wrong');
 *
 * Log levels:
 *   production  → 'info'  (info, warn, error, fatal)
 *   development → 'debug' (all levels)
 *   test        → 'silent' (no output during tests)
 *
 * The transport section (pino-pretty) is only active outside production so
 * structured JSON lands in production log aggregators (Datadog, Papertrail, etc.)
 */
import pino from "pino";
import { env } from "./env";

const isDev = env.NODE_ENV === "development";
const isTest = env.NODE_ENV === "test";

export const logger = pino({
  level: isTest ? "silent" : isDev ? "debug" : "info",

  // In development use pino-pretty for human-readable output.
  // In production emit raw JSON (stdout) for log aggregators.
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
      },
    },
  }),

  // Redact sensitive fields from every log line
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.secret",
      "*.JWT_SECRET",
      "*.RAZORPAY_KEY_SECRET",
    ],
    censor: "[REDACTED]",
  },

  // Base fields on every log line
  base: {
    service: "agroloop-api",
    env: env.NODE_ENV,
  },
});
