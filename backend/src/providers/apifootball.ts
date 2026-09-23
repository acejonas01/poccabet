// API-Football (api-sports.io) — live match data (score, minute, status) + in-play odds.
// Free plan = 100 requests/day, so every call goes through one shared server cache.
// Each refresh costs 2 requests: /fixtures?live=all and /odds/live.

import type { OddsMarket } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";
const CACHE_TTL = Number(process.env.LIVE_CACHE_SECONDS || 300) * 1000;
const DAILY_BUDGET = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 95);

export interface LiveFixture {
  externalId: number;
  league: string;
  country: string;
  leagueLogo: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string; // 1H, HT, 2H, ET, P, ...
  minute: number | null;
  startTime: Date;
  markets: OddsMarket[];
}

interface LiveCache {
  fixtures: LiveFixture[];
  fetchedAt: number;
}

let cache: LiveCache | null = null;
let inFlight: Promise<LiveFixture[]> | null = null;
let usage = { day: "", calls: 0, remaining: Infinity };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function budgetLeft() {
  if (usage.day !== today()) usage = { day: today(), calls: 0, remaining: Infinity };
  return usage.calls < DAILY_BUDGET && usage.remaining > 0;
}

async function apiGet(path: string): Promise<any[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": key },
  });
  usage.calls++;
  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  if (remaining !== null) usage.remaining = Number(remaining);

  if (!res.ok) throw new Error(`API-Football error: ${res.status}`);
  const data: any = await res.json();
  // API-Football reports auth/plan errors in the body with a 200 status.
  const errors = data.errors && Object.keys(data.errors).length ? data.errors : null;
  if (errors) throw new Error(`API-Football error: ${JSON.stringify(errors)}`);
  return data.response || [];
}

// Map API-Football live bets to our market shape; suspended markets are dropped.
function parseLiveOdds(bets: any[]): OddsMarket[] {
  const markets: OddsMarket[] = [];
  const open = (b: any) => b && b.values?.length && !b.values.some((v: any) => v.suspended);

  const ft = bets.find((b) => b.name === "Fulltime Result");
  if (open(ft)) {
    const order = ["Home", "Draw", "Away"];
    markets.push({
      type: "MATCH_WINNER",
      name: "Match Winner",
      outcomes: order
        .map((label) => ft.values.find((v: any) => v.value === label))
        .filter(Boolean)
        .map((v: any) => ({ label: v.value, odds: Number(v.odd) })),
    });
  }

  const goals = bets.find((b) => b.name === "Match Goals");
  if (open(goals)) {
    // Several lines can be listed (2.5, 3.5…); keep only the main one.
    const line = (goals.values.find((v: any) => v.main) ?? goals.values[0]).handicap;
    const main = goals.values.filter((v: any) => v.handicap === line);
    markets.push({
      type: "OVER_UNDER",
      name: "Over/Under",
      outcomes: main.map((v: any) => ({
        label: v.handicap ? `${v.value} ${v.handicap}` : v.value,
        odds: Number(v.odd),
      })),
    });
  }

  return markets;
}

async function fetchLive(): Promise<LiveFixture[]> {
  const fixtures = await apiGet("/fixtures?live=all");

  // Odds are a bonus — if that call fails we still show scores.
  const oddsById = new Map<number, OddsMarket[]>();
  try {
    for (const o of await apiGet("/odds/live")) {
      oddsById.set(o.fixture.id, parseLiveOdds(o.odds || []));
    }
  } catch (err) {
    console.warn("API-Football live odds unavailable:", (err as Error).message);
  }

  return fixtures.map((f: any) => ({
    externalId: f.fixture.id,
    league: f.league.name,
    country: f.league.country,
    leagueLogo: f.league.logo,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
    status: f.fixture.status.short,
    minute: f.fixture.status.elapsed,
    startTime: new Date(f.fixture.date),
    markets: oddsById.get(f.fixture.id) ?? [],
  }));
}

export async function getLiveFixtures() {
  const fresh = cache && Date.now() - cache.fetchedAt < CACHE_TTL;
  if (fresh) return { fixtures: cache!.fixtures, fetchedAt: cache!.fetchedAt, stale: false };
  if (!budgetLeft()) {
    if (cache) return { fixtures: cache.fixtures, fetchedAt: cache.fetchedAt, stale: true };
    throw new Error("API-Football daily budget used up");
  }

  // Collapse simultaneous requests into one upstream call.
  inFlight ??= fetchLive().finally(() => { inFlight = null; });
  try {
    const fixtures = await inFlight;
    cache = { fixtures, fetchedAt: Date.now() };
    return { fixtures, fetchedAt: cache.fetchedAt, stale: false };
  } catch (err) {
    if (cache) return { fixtures: cache.fixtures, fetchedAt: cache.fetchedAt, stale: true };
    throw err;
  }
}

export function getApiFootballUsage() {
  budgetLeft();
  return { ...usage, budget: DAILY_BUDGET, cacheSeconds: CACHE_TTL / 1000 };
}
