import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn } from "./auth";

const today = new Date(Date.UTC(2026, 8, 26)); // 26 Sep 2026
test("age in whole years, birthday counted on the day", () => {
  assert.equal(ageOn("2008-09-26", today), 18); // 18 today
  assert.equal(ageOn("2008-09-27", today), 17); // 18 tomorrow
  assert.equal(ageOn("1990-01-15", today), 36);
});
test("impossible or future dates", () => {
  assert.equal(ageOn("2001-02-30", today), null);
  assert.equal(ageOn("2030-01-01", today), null);
});
