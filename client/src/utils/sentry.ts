/**
 * sentry.ts — Frontend Sentry initialisation (@sentry/react v9).
 *
 * Import this at the TOP of main.tsx (before React renders) so Sentry can
 * install its error capturing hooks before any user code runs.
 *
 * Required environment variable (add to client/.env / Vercel dashboard):
 *   VITE_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project-id>
 *
 * Optional:
 *   VITE_APP_VERSION=1.0.0   (appears in Sentry releases)
 *
 * If VITE_SENTRY_DSN is absent the SDK is not initialised — the app runs
 * normally without telemetry. Safe for local development.
 *
 * React Router note:
 *   This project uses <BrowserRouter> (not createBrowserRouter), so we use
 *   the standard browserTracingIntegration from @sentry/browser which works
 *   with any router via the History API. Page-view spans are captured
 *   automatically on every navigation.
 */
import * as Sentry from "@sentry/react";

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

  if (!dsn) {
    if (import.meta.env.MODE !== "test") {
      // Only warn in non-test environments — keeps test output clean
      console.warn(
        "[Sentry] VITE_SENTRY_DSN not configured — frontend error tracking is disabled."
      );
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,

    // 100 % of traces captured in dev; 10 % in prod to keep quota in check.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

    integrations: [
      // Automatic page-view spans on browser History API navigation.
      // Works with <BrowserRouter> without any extra wiring.
      Sentry.browserTracingIntegration(),

      // Captures the React component tree in error reports so you can see
      // exactly which component threw and what its props were.
      Sentry.reactErrorHandler(),
    ],

    // Suppress known benign browser errors that aren't actionable
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Network Error$/,
      /^Load failed$/,
    ],

    // Don't send events from localhost in development mode — avoids quota
    // consumption during local testing.
    beforeSend(event) {
      if (
        !import.meta.env.PROD &&
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1")
      ) {
        return null;
      }
      return event;
    },
  });
};

export { Sentry };
