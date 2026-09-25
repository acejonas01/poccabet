// Betting limits. Each can be changed per environment without a code change (values in naira).
import { SIMULATE } from "../lib/feedMode";
import { toKobo } from "./money";

const env = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

export const RULES = {
  minStake: toKobo(env("BET_MIN_STAKE", 100)),
  maxStake: toKobo(env("BET_MAX_STAKE", 1_000_000)),
  maxSelections: env("BET_MAX_SELECTIONS", 30),
  maxPayout: toKobo(env("BET_MAX_PAYOUT", 50_000_000)),
  // Play money: what a new account starts with, and the demo top-up (simulation only).
  startingBalance: SIMULATE ? toKobo(env("DEMO_STARTING_BALANCE", 10_000)) : 0,
  demoTopUp: toKobo(10_000),
  demoTopUpBelow: toKobo(100_000), // top-ups stop once a demo wallet holds this much
};
