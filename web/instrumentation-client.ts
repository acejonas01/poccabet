// Error alerts (Sentry) for what runs in players' browsers, when NEXT_PUBLIC_SENTRY_DSN is set
// (it's read at build time, so set it on Vercel before deploying). Errors only; nothing personal.
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

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

// Product analytics (PostHog, EU), when NEXT_PUBLIC_POSTHOG_KEY is set (read at build time, like
// Sentry's). Shows how players use the site: page views, sign-up → deposit → bet funnels, which
// features get used, session replays. Private by design:
// - everything typed into forms is masked in replays (passwords, amounts, codes);
// - players are identified by their internal id only (frontend/src/lib/analytics.ts), never name/phone/email;
// - the office (/office) is never tracked.
// It's sent through this site (/ingest, see next.config.ts) so ad blockers don't drop it.
const office = () => window.location.pathname.startsWith("/office");
if (process.env.NEXT_PUBLIC_POSTHOG_KEY && !office()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-08-30", // includes page views on every in-app page change
    person_profiles: "identified_only",
    mask_personal_data_properties: true,
    session_recording: { maskAllInputs: true },
    before_send: (event) => (office() ? null : event),
  });
  (window as unknown as { posthog: typeof posthog }).posthog = posthog; // for frontend/src/lib/analytics.ts
}

// Lets Sentry follow page changes (so an error shows which page it happened on).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
