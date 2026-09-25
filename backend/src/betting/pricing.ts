// Checks each selection on a slip against the feed and prices it with the SERVER's odds.
// Pure (no database, no network) so it can be tested on its own.
import type { BettableMatch } from "./feed";
import { marketById } from "./markets";

export interface LegRequest {
  matchId: string;
  market: string; // market id, e.g. "1x2"
  selection: string; // column label, e.g. "X"
  odds: number; // the price the user saw
}

export interface PricedLeg {
  match: BettableMatch;
  market: string;
  marketLabel: string;
  selection: string;
  odds: number; // the price the bet is struck at
}

// What the user agreed to when prices move between seeing and placing:
// "higher" = take better prices automatically, ask about worse ones (default);
// "any" = take any change; "none" = ask about every change.
export type OddsPolicy = "higher" | "any" | "none";

export type LegProblemReason = "NOT_FOUND" | "STARTED" | "SUSPENDED" | "UNKNOWN_MARKET" | "ODDS_CHANGED";

export interface LegProblem {
  matchId: string;
  market: string;
  selection: string;
  reason: LegProblemReason;
  odds?: number; // the current price, for ODDS_CHANGED
}

export function acceptsChange(seen: number, now: number, policy: OddsPolicy) {
  if (Math.abs(now - seen) < 0.005) return true;
  if (policy === "any") return true;
  if (policy === "higher") return now > seen;
  return false;
}

export function priceLegs(requests: LegRequest[], matches: Map<string, BettableMatch | null>, policy: OddsPolicy) {
  const legs: PricedLeg[] = [];
  const problems: LegProblem[] = [];
  for (const r of requests) {
    const base = { matchId: r.matchId, market: r.market, selection: r.selection };
    const match = matches.get(r.matchId);
    if (!match) { problems.push({ ...base, reason: "NOT_FOUND" }); continue; }
    if (match.state === "started") { problems.push({ ...base, reason: "STARTED" }); continue; }
    const def = marketById(r.market);
    const col = def ? def.cols.indexOf(r.selection) : -1;
    if (!def || col === -1) { problems.push({ ...base, reason: "UNKNOWN_MARKET" }); continue; }
    const price = match.prices[r.market]?.[col] ?? 0;
    if (!(price > 1)) { problems.push({ ...base, reason: "SUSPENDED" }); continue; }
    if (!acceptsChange(r.odds, price, policy)) { problems.push({ ...base, reason: "ODDS_CHANGED", odds: price }); continue; }
    legs.push({ match, market: r.market, marketLabel: def.label, selection: r.selection, odds: price });
  }
  return { legs, problems };
}

// Accumulator odds: the product, rounded to 2 decimals as shown on the slip.
export const totalOdds = (odds: number[]) => Math.round(odds.reduce((a, o) => a * o, 1) * 100) / 100;

// Payout in kobo, rounded down so we never promise more than the maths gives.
export const payoutKobo = (stakeKobo: number, odds: number) => Math.floor(stakeKobo * odds);
