/**
 * sentry.ts — Backend Sentry initialisation (Sentry SDK v9+).
 *
 * IMPORTANT: Call initSentry() BEFORE any other imports in server.ts so
 * Sentry's OTel-based auto-instrumentation patches all modules correctly.
 *
 * Required environment variables (add to .env / hosting dashboard):
 *   SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project-id>
 *
 * If SENTRY_DSN is absent the SDK init is skipped — the app runs normally
 * without any telemetry. Keeps local development free of Sentry noise.
 */
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { env } from "./env";

export const initSentry = (): void => {
  const dsn = env.SENTRY_DSN;

  if (!dsn) {
    if (env.NODE_ENV !== "test") {
      // Use process.stderr directly — logger may not be initialised yet
      process.stderr.write(
        "[Sentry] SENTRY_DSN not configured — error tracking is disabled.\n"
      );
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: env.NODE_ENV,
    release: process.env.npm_package_version,

    // Capture 100 % of traces in development, 10 % in production.
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Profile 100 % of sampled transactions.
    profilesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

    integrations: [nodeProfilingIntegration()],

    // Don't report 4xx client errors as Sentry issues — they are expected.
    // Only 5xx and unhandled rejections go to Sentry.
    beforeSend(event) {
      const status = event.extra?.statusCode as number | undefined;
      if (status && status >= 400 && status < 500) return null;
      return event;
    },
  });
};

// Re-export the whole Sentry namespace so consumers don't need a second import.
export { Sentry };
