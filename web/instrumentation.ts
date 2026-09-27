// Pages are rendered on the server: show match times in Nigerian time there (the browser then
// shows each visitor's own time, which for Nigeria is the same).
// Error alerts (Sentry) for the server side of this site, when SENTRY_DSN is set; the browser
// side is in instrumentation-client.ts.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  process.env.TZ = "Africa/Lagos";
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV || "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0,
      dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false, httpHeaders: { allow: ["user-agent", "referer"] } },
    });
  }
}

// Errors while rendering a page on the server.
export const onRequestError = Sentry.captureRequestError;
