import { test } from "node:test";
import assert from "node:assert/strict";
import { betOutcome, gradeSelection } from "./grade";
import { MARKETS } from "./markets";

const score = (home: number, away: number, htHome: number | null = 0, htAway: number | null = 0) => ({ home, away, htHome, htAway });
const g = (market: string, sel: string, s = score(2, 1, 1, 1)) => gradeSelection(market, sel, s);

test("1X2, double chance, draw no bet", () => {
  assert.equal(g("1x2", "1"), "WON");
  assert.equal(g("1x2", "X"), "LOST");
  assert.equal(g("1x2", "X", score(1, 1)), "WON");
  assert.equal(g("dc", "1X"), "WON");
  assert.equal(g("dc", "12"), "WON");
  assert.equal(g("dc", "X2"), "LOST");
  assert.equal(g("dc", "12", score(0, 0)), "LOST");
  assert.equal(g("dc", "X2", score(0, 0)), "WON");
  assert.equal(g("dnb", "1"), "WON");
  assert.equal(g("dnb", "2", score(1, 1)), "VOID");
});

test("goals markets", () => {
  assert.equal(g("ou", "Over"), "WON"); // 3 goals > 2.5
  assert.equal(g("ou", "Under"), "LOST");
  assert.equal(g("ou15", "Over", score(1, 0)), "LOST");
  assert.equal(g("ou35", "Under"), "WON");
  assert.equal(g("gg", "GG"), "WON");
  assert.equal(g("gg", "NG", score(2, 0)), "WON");
  assert.equal(g("oe", "Odd"), "WON");
  assert.equal(g("oe", "Even", score(0, 0)), "WON"); // 0 goals is even
});

test("handicap (home -1), half-time, correct score", () => {
  assert.equal(g("hc", "1 (-1)", score(3, 1)), "WON");
  assert.equal(g("hc", "X (-1)"), "WON"); // 2-1 → 1-1 after the handicap
  assert.equal(g("hc", "2 (+1)"), "LOST");
  assert.equal(g("hc", "2 (+1)", score(1, 1)), "WON");
  assert.equal(g("ht", "X"), "WON"); // 1-1 at half-time
  assert.equal(g("ht", "1"), "LOST");
  assert.equal(gradeSelection("ht", "1", score(2, 1, null, null)), null); // no half-time score: can't grade yet
  assert.equal(g("cs", "2-1"), "WON");
  assert.equal(g("cs", "1-0"), "LOST");
});

test("every market and column the site offers can be graded", () => {
  for (const m of MARKETS) for (const col of m.cols) {
    assert.notEqual(gradeSelection(m.id, col, score(1, 0, 1, 0)), null, `${m.id} ${col}`);
  }
});

test("bet outcome: lost as soon as a leg loses, void legs count as 1.00", () => {
  assert.deepEqual(betOutcome([{ result: "LOST", odds: 2 }, { result: "PENDING", odds: 3 }], 100_000), { status: "LOST", payout: 0 });
  assert.deepEqual(betOutcome([{ result: "WON", odds: 2 }, { result: "PENDING", odds: 3 }], 100_000), { status: "PENDING" });
  assert.deepEqual(betOutcome([{ result: "WON", odds: 2 }, { result: "WON", odds: 1.5 }], 100_000), { status: "WON", payout: 300_000 });
  assert.deepEqual(betOutcome([{ result: "WON", odds: 2 }, { result: "VOID", odds: 3 }], 100_000), { status: "WON", payout: 200_000 });
  assert.deepEqual(betOutcome([{ result: "VOID", odds: 2 }], 100_000), { status: "VOID", payout: 100_000 });
});
