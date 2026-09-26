// Server-side: the live and upcoming feed, fetched from the backend when a page is rendered,
// so the HTML already lists the matches (and odds) for search engines. Cached for 30s.
import type { InitialFeed } from "../../frontend/src/redesign/data";

export const BACKEND = process.env.BACKEND_URL || "https://poccabet.onrender.com";

async function get(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${BACKEND}${path}`, { next: { revalidate: 30 }, signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // backend asleep/slow: the page renders without matches and the browser loads them
  }
}

export async function getFeed(): Promise<InitialFeed | null> {
  const [live, upcoming, pick] = await Promise.all([get("/api/live"), get("/api/live/upcoming"), get("/api/picks/top")]);
  if (!live && !upcoming) return null;
  return {
    live: live?.fixtures ?? [],
    upcoming: upcoming?.events ?? [],
    simulated: !!(live?.simulated || upcoming?.simulated),
    ...(pick ? { topPick: pick.top ?? null } : {}),
  };
}

// "England", "Premier League" → "england-premier-league" (same as the site's league URLs).
export const leagueSlug = (country: string, name: string) =>
  `${country} ${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function leaguesIn(feed: InitialFeed | null) {
  type League = { slug: string; name: string; country: string; matches: { home: string; away: string; start: string }[] };
  const map = new Map<string, League>();
  for (const e of feed?.upcoming ?? []) {
    const country = e.country ?? "";
    const slug = leagueSlug(country, e.league);
    const row: League = map.get(slug) ?? { slug, name: e.league, country, matches: [] };
    row.matches.push({ home: e.homeTeam, away: e.awayTeam, start: e.startTime });
    map.set(slug, row);
  }
  return [...map.values()];
}
