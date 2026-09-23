// Combines every upcoming-games provider into one feed.
// Big leagues (The Odds API) come first, then API-Football fills the rest.
// The same match from two providers is kept once (the first provider wins).

import { getOddsProvider } from ".";
import { getUpcomingAndResults } from "./apifootball";
import type { OddsEvent } from "./types";

const MAX_UPCOMING = 30;
const SAME_KICKOFF_MS = 60 * 60 * 1000;

// "Manchester United FC" / "Man. United" → "manchester united" / "man united"
function normTeam(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(fc|afc|cf|sc|ac|club|de|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameTeam(a: string, b: string) {
  const x = normTeam(a);
  const y = normTeam(b);
  return x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)));
}

function sameMatch(a: OddsEvent, b: OddsEvent) {
  return (
    Math.abs(new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) <= SAME_KICKOFF_MS &&
    sameTeam(a.homeTeam, b.homeTeam) &&
    sameTeam(a.awayTeam, b.awayTeam)
  );
}

async function safe(load: () => Promise<OddsEvent[]>, source: string) {
  try {
    return await load();
  } catch (err) {
    console.warn(`Upcoming feed: ${source} unavailable:`, (err as Error).message);
    return [];
  }
}

export async function getUpcomingMerged() {
  const now = Date.now();
  const byKickoff = (a: OddsEvent, b: OddsEvent) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime();

  const [bigLeagues, apiFootball] = await Promise.all([
    safe(() => getOddsProvider().fetchEvents(), "the-odds-api"),
    safe(async () => (await getUpcomingAndResults()).data.upcoming, "api-football"),
  ]);

  const merged: OddsEvent[] = [];
  for (const list of [bigLeagues, apiFootball]) {
    for (const evt of [...list].sort(byKickoff)) {
      if (new Date(evt.startTime).getTime() <= now) continue;
      if (!evt.markets.length) continue;
      if (merged.some((m) => sameMatch(m, evt))) continue;
      merged.push(evt);
    }
  }

  return {
    events: merged.slice(0, MAX_UPCOMING),
    sources: { "the-odds-api": bigLeagues.length, "api-football": apiFootball.length },
  };
}
