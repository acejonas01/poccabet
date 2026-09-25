// The server re-prices bets with its own copy of the site's market formulas. If the two ever
// differ, every bet on that market would bounce with "odds changed" — this test catches it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOdds as serverDerive, MARKETS } from "./markets";
import { deriveOdds as siteDerive, MK, CORRECT_SCORE } from "../../../frontend/src/redesign/markets";

const samples: [number[], number[]][] = [
  [[2.1, 3.4, 3.2], [1.9, 1.9]],
  [[1.25, 6.5, 11], [1.55, 2.4]],
  [[4.8, 3.9, 1.7], [2.2, 1.65]],
  [[2.1, 3.4, 3.2], [0, 0]],
  [[0, 0, 0], [1.9, 1.9]],
];

test("server prices match the site's prices for every market", () => {
  for (const [o, ou] of samples) assert.deepEqual(serverDerive(o, ou), siteDerive(o, ou));
});

test("server markets have the site's ids and column labels", () => {
  const site = [...MK, CORRECT_SCORE].map((m) => ({ id: m.id, label: m.label, cols: m.cols })).sort((a, b) => a.id.localeCompare(b.id));
  const server = MARKETS.map((m) => ({ id: m.id, label: m.label, cols: m.cols })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(server, site);
});
