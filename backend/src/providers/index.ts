import type { OddsProvider } from "./types";
import { TheOddsApiProvider } from "./theoddsapi";

const providers: Record<string, () => OddsProvider> = {
  "the-odds-api": () => new TheOddsApiProvider(),
};

let instance: OddsProvider | null = null;

export function getOddsProvider(): OddsProvider {
  if (instance) return instance;
  const name = process.env.ODDS_PROVIDER || "the-odds-api";
  const factory = providers[name];
  if (!factory) throw new Error(`Unknown odds provider: ${name}. Available: ${Object.keys(providers).join(", ")}`);
  instance = factory();
  return instance;
}

export type { OddsProvider, OddsEvent, OddsMarket, OddsOutcome } from "./types";
