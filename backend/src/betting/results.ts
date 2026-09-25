// Where final scores come from, for settling bets. Like feed.ts, this is the one place that
// talks to a provider: the simulation today, a real results feed later.
import { SIMULATE } from "../lib/feedMode";
import { getUpcomingAndResults } from "../providers/apifootball";
import { simResult } from "../providers/simulation";

export type MatchResult =
  | { status: "FINISHED"; home: number; away: number; htHome: number | null; htAway: number | null }
  | { status: "VOID" } // cancelled / abandoned / postponed for good: selections are void
  | { status: "NOT_FINISHED" }
  | { status: "UNKNOWN" }; // the source can't find it (yet)

export async function getResults(matches: { matchId: string; kickoff: Date }[], now = Date.now()): Promise<Map<string, MatchResult>> {
  const out = new Map<string, MatchResult>();
  if (SIMULATE) {
    for (const m of matches) out.set(m.matchId, simResult(m.matchId, m.kickoff, now));
    return out;
  }
  // Live: today's finished games from API-Football (full-time score only, no half-time).
  // A real results provider should also send half-time scores and cancellations.
  const finished = await getUpcomingAndResults().then((r) => r.data.finished).catch(() => []);
  const byId = new Map(finished.map((f) => [f.externalId, f]));
  for (const m of matches) {
    const f = byId.get(m.matchId);
    out.set(m.matchId, f && f.homeGoals !== null && f.awayGoals !== null
      ? { status: "FINISHED", home: f.homeGoals, away: f.awayGoals, htHome: null, htAway: null }
      : { status: "UNKNOWN" });
  }
  return out;
}
