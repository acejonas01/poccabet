// Error alerts (Sentry) for what runs in players' browsers, when NEXT_PUBLIC_SENTRY_DSN is set
// (it's read at build time, so set it on Vercel before deploying). Errors only; nothing personal.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || "development",
    tracesSampleRate: 0,
    dataCollection: { userInfo: false, cookies: false, urlQueryParams: false },
    // Noise that isn't ours to fix: flaky mobile connections, browser extensions, cancelled loads.
    ignoreErrors: ["Failed to fetch", "Load failed", "NetworkError", "AbortError", "The operation was aborted", "ResizeObserver loop", "Non-Error promise rejection captured"],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
  });
}

// Lets Sentry follow page changes (so an error shows which page it happened on).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
