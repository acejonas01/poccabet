// The Next.js site (web/) renders pages on the server first. There, window/localStorage don't
// exist, and in the browser the first render must match the server's HTML — so anything saved
// on the device (login, bet slip, remembered tabs…) is read right after that first render.
// The Vite site doesn't render on a server, so it keeps reading storage straight away.
import { useEffect, useState } from "react";

declare global {
  interface Window { __POCCA_SSR__?: boolean }
}

// True on the server, and in the browser when the page came from the server (Next.js).
export const deferDeviceState = () => typeof window === "undefined" || window.__POCCA_SSR__ === true;

// useState whose starting value comes from the device (storage, screen size…), SSR-safe.
export function useDeviceState<T>(read: () => T, fallback: T) {
  const deferred = deferDeviceState();
  const [value, setValue] = useState<T>(() => {
    if (deferred) return fallback;
    try { return read(); } catch { return fallback; }
  });
  useEffect(() => {
    if (!deferred) return;
    try { setValue(read()); } catch { /* keep the fallback */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [value, setValue] as const;
}

// Match times. Server pages are rendered in Nigerian time, so the browser uses it too for its
// first render (the page hydrates cleanly), then switches to the visitor's own clock.
const SERVER_ZONE = "Africa/Lagos";
let zone: string | undefined | null = null; // null = not decided yet
const clockZone = () => (zone === null ? (zone = deferDeviceState() ? SERVER_ZONE : undefined) : zone);
export const switchToVisitorClock = () => { zone = undefined; };

// Minutes a zone is ahead of UTC at time t.
function zoneOffset(tz: string, t: number) {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(t)) p[x.type] = x.value;
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000) / 60000;
}

// A Date whose getHours(), toDateString()… read the wall clock of the display zone.
export function zoned(t = Date.now()) {
  const tz = clockZone();
  if (!tz) return new Date(t);
  return new Date(t + (zoneOffset(tz, t) + new Date(t).getTimezoneOffset()) * 60000);
}
