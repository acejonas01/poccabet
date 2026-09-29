// Product analytics (PostHog), where it's switched on: the Next.js site starts it (web/instrumentation-
// client.ts) when NEXT_PUBLIC_POSTHOG_KEY is set, and puts it on window. Elsewhere (the Vite site,
// server rendering, no key) these calls do nothing.
// Events carry what happened (amounts, counts, odds), never who: players are known by their internal
// id only (no name, phone or email).
type PostHogLike = {
  capture: (event: string, props?: Record<string, unknown>) => void;
  identify: (id: string) => void;
  reset: () => void;
};
const ph = () => (typeof window === "undefined" ? undefined : (window as unknown as { posthog?: PostHogLike }).posthog);

export const track = (event: string, props?: Record<string, unknown>) => ph()?.capture(event, props);
export const identifyPlayer = (id: string) => ph()?.identify(id);
export const forgetPlayer = () => ph()?.reset();
