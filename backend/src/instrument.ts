// Error alerts (Sentry). Loaded first, before the app, so it sees every request. Off unless
// SENTRY_DSN is set. Crashes, 5xx errors and console.error calls are sent (grouped, with where in
// the code they happened); Sentry emails / pushes the alerts. Nothing personal is sent: login
// tokens, cookies, admin keys and request bodies (passwords, bank details…) are stripped first.
import * as Sentry from "@sentry/node";

const HIDDEN_HEADERS = ["authorization", "cookie", "x-admin-key", "x-paystack-signature", "x-forwarded-for"];

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || (process.env.RENDER ? "production" : "development"),
    release: process.env.RENDER_GIT_COMMIT, // Render sets this: errors show which deploy they came from
    // Collect as little as possible: no user details, cookies, bodies or query strings, and only
    // harmless headers. beforeSend below strips the same things again, in case.
    dataCollection: { userInfo: false, cookies: false, httpBodies: [], urlQueryParams: false, httpHeaders: { allow: ["user-agent", "content-type", "referer"] } },
    tracesSampleRate: 0, // errors only, no performance tracing (keeps within the free plan)
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })], // our console.error(…) calls too
    beforeSend(event) {
      const req = event.request;
      if (req) {
        delete req.cookies;
        delete req.data;
        if (req.headers) for (const h of HIDDEN_HEADERS) delete req.headers[h];
        if (req.query_string) req.query_string = "[hidden]";
      }
      if (event.user) event.user = { id: event.user.id }; // never emails / IPs
      return event;
    },
  });
}

export { Sentry };
