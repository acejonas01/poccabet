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
  // New accounts start empty. The welcome bonus is claimed once, after verifying the email
  // (play money in simulation; off with real money until bonus terms exist — set WELCOME_BONUS).
  startingBalance: 0,
  welcomeBonus: toKobo(Number(process.env.WELCOME_BONUS ?? (SIMULATE ? 10_000 : 0)) || 0),
};
