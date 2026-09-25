// The betting feed: finds a match and its current prices for placing a bet.
// Everything else in betting/ only talks to this file, so moving from the simulation to a real
// provider (or a different one) happens here — and only here.
import { SIMULATE } from "../lib/feedMode";
import { getUpcomingMerged } from "../providers/aggregate";
import { getLiveFixtures, type LiveFixture } from "../providers/apifootball";
import { simLive, simUpcoming } from "../providers/simulation";
import type { OddsEvent, OddsMarket } from "../providers/types";
import { deriveOdds } from "./markets";

export interface BettableMatch {
  matchId: string; // same id the site uses, e.g. "af-12345"
  home: string;
  away: string;
  league: string;
  country: string;
  kickoff: Date;
  state: "upcoming" | "live" | "started"; // started = kicked off but not in the live feed yet
  prices: Record<string, number[]>; // market id → price per column, 0 = suspended
}

export const FEED_SOURCE = SIMULATE ? "simulation" : "live";

// ---------- reading a provider's markets (same rules as the site's data.ts) ----------
function oneXTwo(markets: OddsMarket[]): number[] {
  const mw = markets?.find((m) => m.type === "MATCH_WINNER" || m.type === "HEAD_TO_HEAD");
  const outs = mw?.outcomes ?? [];
  return outs.length === 3 ? outs.map((x) => Number(x.odds) || 0) : [0, 0, 0];
}
function overUnder25(markets: OddsMarket[]): number[] {
  const ou = markets?.find((m) => m.type === "OVER_UNDER");
  const over = ou?.outcomes?.find((x) => /over/i.test(x.label) && x.label.includes("2.5"));
  const under = ou?.outcomes?.find((x) => /under/i.test(x.label) && x.label.includes("2.5"));
  return [Number(over?.odds) || 0, Number(under?.odds) || 0];
}

// Today every market is derived from 1X2 + O/U 2.5. A provider that sends all markets itself
// would map them here instead (keeping the market ids and column labels in markets.ts).
function pricesFrom(markets: OddsMarket[], suspended: boolean): Record<string, number[]> {
  const prices = deriveOdds(oneXTwo(markets), overUnder25(markets));
  if (!suspended) return prices;
  return Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v.map(() => 0)]));
}

function fromLive(f: LiveFixture, stale: boolean): BettableMatch {
  return {
    matchId: `af-${f.externalId}`,
    home: f.homeTeam,
    away: f.awayTeam,
    league: f.league,
    country: f.country ?? "",
    kickoff: new Date(f.startTime),
    state: "live",
    // In-play prices go out of date fast: if the provider's data is stale, take no live bets.
    prices: pricesFrom(f.markets, stale),
  };
}

function fromUpcoming(e: OddsEvent, now: number): BettableMatch {
  const kickoff = new Date(e.startTime);
  return {
    matchId: e.externalId,
    home: e.homeTeam,
    away: e.awayTeam,
    league: e.league,
    country: e.country ?? "",
    kickoff,
    state: kickoff.getTime() > now ? "upcoming" : "started",
    prices: pricesFrom(e.markets, false),
  };
}

async function currentMatches(): Promise<BettableMatch[]> {
  const now = Date.now();
  if (SIMULATE) {
    return [...simLive(now).map((f) => fromLive(f, false)), ...simUpcoming(now).map((e) => fromUpcoming(e, now))];
  }
  const [live, upcoming] = await Promise.all([
    getLiveFixtures().catch(() => null),
    getUpcomingMerged().catch(() => null),
  ]);
  return [
    ...(live?.data ?? []).map((f) => fromLive(f, live!.stale)),
    ...(upcoming?.events ?? []).map((e) => fromUpcoming(e, now)),
  ];
}

// Look up several matches at once (one feed read). Missing ids map to null.
export async function findMatches(ids: string[]): Promise<Map<string, BettableMatch | null>> {
  const all = await currentMatches();
  const byId = new Map<string, BettableMatch>();
  // Live wins over upcoming if a match briefly appears in both.
  for (const m of all) if (!byId.has(m.matchId)) byId.set(m.matchId, m);
  return new Map(ids.map((id) => [id, byId.get(id) ?? null]));
}
