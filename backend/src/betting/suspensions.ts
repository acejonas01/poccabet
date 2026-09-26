// Matches an admin has suspended: no new bets, and their odds go out as 0 (shown locked).
// The list is read at most every few seconds; admin changes clear it straight away.
import { prisma } from "../lib/prisma";
import type { OddsMarket } from "../providers/types";

let cache: { at: number; ids: Set<string> } | null = null;
const TTL_MS = 5_000;

export async function suspendedIds(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids;
  try {
    const rows = await prisma.suspendedMatch.findMany({ select: { matchId: true } });
    cache = { at: Date.now(), ids: new Set(rows.map((r) => r.matchId)) };
  } catch (err) {
    console.error("suspended matches unavailable:", err);
    if (!cache) return new Set(); // the feed keeps working without the list
  }
  return cache!.ids;
}

export function forgetSuspensions() {
  cache = null;
}

// The same fixture/event with every price set to 0.
export function lockMarkets<T extends { markets: OddsMarket[] }>(item: T): T {
  return { ...item, markets: (item.markets ?? []).map((m) => ({ ...m, outcomes: m.outcomes.map((o) => ({ ...o, odds: 0 })) })) };
}
