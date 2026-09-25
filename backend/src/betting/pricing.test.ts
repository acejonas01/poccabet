import { test } from "node:test";
import assert from "node:assert/strict";
import type { BettableMatch } from "./feed";
import { deriveOdds } from "./markets";
import { acceptsChange, payoutKobo, priceLegs, totalOdds } from "./pricing";

const match = (over: Partial<BettableMatch> = {}): BettableMatch => ({
  matchId: "af-1", home: "Arsenal", away: "Chelsea", league: "Premier League", country: "England",
  kickoff: new Date(Date.now() + 3600_000), state: "upcoming", prices: deriveOdds([2.1, 3.4, 3.2], [1.9, 1.9]), ...over,
});
const feed = (...ms: BettableMatch[]) => new Map(ms.map((m) => [m.matchId, m] as [string, BettableMatch | null]));

test("prices a selection with the server's odds", () => {
  const { legs, problems } = priceLegs([{ matchId: "af-1", market: "1x2", selection: "X", odds: 3.4 }], feed(match()), "higher");
  assert.equal(problems.length, 0);
  assert.equal(legs[0].odds, 3.4);
  assert.equal(legs[0].marketLabel, "1X2");
});

test("unknown match, started match, bad market and suspended price are refused", () => {
  const started = match({ matchId: "af-2", state: "started" });
  const locked = match({ matchId: "af-3", prices: deriveOdds([0, 0, 0], [0, 0]) });
  const { legs, problems } = priceLegs([
    { matchId: "af-9", market: "1x2", selection: "1", odds: 2 },
    { matchId: "af-2", market: "1x2", selection: "1", odds: 2.1 },
    { matchId: "af-1", market: "nope", selection: "1", odds: 2 },
    { matchId: "af-1", market: "1x2", selection: "Q", odds: 2 },
    { matchId: "af-3", market: "1x2", selection: "1", odds: 2 },
  ], feed(match(), started, locked), "any");
  assert.equal(legs.length, 0);
  assert.deepEqual(problems.map((p) => p.reason), ["NOT_FOUND", "STARTED", "UNKNOWN_MARKET", "UNKNOWN_MARKET", "SUSPENDED"]);
});

test("odds changes follow the user's policy", () => {
  assert.equal(acceptsChange(2.0, 2.0, "none"), true);
  assert.equal(acceptsChange(2.0, 2.1, "higher"), true);
  assert.equal(acceptsChange(2.0, 1.9, "higher"), false);
  assert.equal(acceptsChange(2.0, 1.9, "any"), true);
  assert.equal(acceptsChange(2.0, 2.1, "none"), false);
  const { problems } = priceLegs([{ matchId: "af-1", market: "1x2", selection: "1", odds: 2.5 }], feed(match()), "higher");
  assert.equal(problems[0].reason, "ODDS_CHANGED");
  assert.equal(problems[0].odds, 2.1);
});

test("accumulator odds and payouts in kobo", () => {
  assert.equal(totalOdds([2.1, 1.5, 3.2]), 10.08);
  assert.equal(payoutKobo(100_000, 2.15), 215_000); // ₦1,000 at 2.15 = ₦2,150
  assert.equal(payoutKobo(33_333, 1.37), 45_666); // rounded down, never up
});
