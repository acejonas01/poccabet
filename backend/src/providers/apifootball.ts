// API-Football (api-sports.io) — live games + in-play odds, and upcoming games + pre-match odds.
// Free plan = 100 requests/day, so every call goes through a shared server cache.
//   LIVE refresh     = 2 requests (/fixtures?live=all, /odds/live)
//   UPCOMING refresh = up to 5 requests (up to 3 /odds pages + 1 /fixtures?date per day used)
//   RESULTS          = 0 extra requests (finished games come from today's /fixtures?date)
// UPCOMING_DAILY_RESERVE calls are kept back so LIVE can't starve UPCOMING.

import type { OddsEvent, OddsMarket } from "./types";

const BASE_URL = "https://v3.football.api-sports.io";
const LIVE_TTL = Number(process.env.LIVE_CACHE_SECONDS || 300) * 1000;
const UPCOMING_TTL = Number(process.env.UPCOMING_CACHE_SECONDS || 10800) * 1000;
const DAILY_BUDGET = Number(process.env.API_FOOTBALL_DAILY_BUDGET || 95);
const UPCOMING_RESERVE = Number(process.env.UPCOMING_DAILY_RESERVE || 40);
const ERROR_BACKOFF = 10 * 60 * 1000;
const UPCOMING_SIZE = 15;
const MAX_ODDS_PAGES = 3;
const BET365 = 8;
const RESULTS_SIZE = 30;
const FINISHED = new Set(["FT", "AET", "PEN"]);
// Popular leagues (API-Football ids) listed first in results: UCL, UEL, UECL,
// EPL, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, NPFL.
const POPULAR_LEAGUES = [2, 3, 848, 39, 140, 135, 78, 61, 88, 94, 399];

export interface FinishedFixture {
  externalId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  status: string; // FT, AET, PEN
  homeGoals: number | null;
  awayGoals: number | null;
}

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

let usage = { day: "", calls: 0, remaining: Infinity };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function budgetLeft(reserve = 0) {
  if (usage.day !== today()) usage = { day: today(), calls: 0, remaining: Infinity };
  return usage.calls < DAILY_BUDGET - reserve && usage.remaining > reserve;
}

async function apiGet(path: string): Promise<any> {
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
  return data;
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
  const fixtures = (await apiGet("/fixtures?live=all")).response ?? [];

  // Odds are a bonus — if that call fails we still show scores.
  const oddsById = new Map<number, OddsMarket[]>();
  try {
    for (const o of (await apiGet("/odds/live")).response ?? []) {
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

// Pre-match bets (Bet365): Match Winner + Over/Under 2.5.
function parsePrematchOdds(bets: any[]): OddsMarket[] {
  const markets: OddsMarket[] = [];
  const mw = bets.find((b) => b.id === 1);
  if (mw?.values?.length) {
    markets.push({
      type: "MATCH_WINNER",
      name: "Match Winner",
      outcomes: ["Home", "Draw", "Away"]
        .map((label) => mw.values.find((v: any) => v.value === label))
        .filter(Boolean)
        .map((v: any) => ({ label: v.value, odds: Number(v.odd) })),
    });
  }
  const ou = bets.find((b) => b.id === 5);
  const line = ou?.values?.filter((v: any) => v.value === "Over 2.5" || v.value === "Under 2.5");
  if (line?.length === 2) {
    markets.push({
      type: "OVER_UNDER",
      name: "Over/Under",
      outcomes: line.map((v: any) => ({ label: v.value, odds: Number(v.odd) })),
    });
  }
  return markets;
}

async function fetchUpcoming(): Promise<{ upcoming: OddsEvent[]; finished: FinishedFixture[] }> {
  const soon = Date.now() + 5 * 60 * 1000;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const picked = new Map<number, OddsMarket[]>();
  // Today is always fetched so finished results come along for free.
  const daysUsed = new Set<string>([today()]);
  let pages = 0;

  // Odds come 10 fixtures per page; take games that haven't kicked off yet.
  for (const day of [today(), tomorrow]) {
    for (let page = 1; pages < MAX_ODDS_PAGES && picked.size < UPCOMING_SIZE; page++) {
      const data = await apiGet(`/odds?date=${day}&bookmaker=${BET365}&page=${page}`);
      pages++;
      for (const o of data.response ?? []) {
        if (new Date(o.fixture.date).getTime() < soon) continue;
        const markets = parsePrematchOdds(o.bookmakers?.[0]?.bets ?? []);
        if (!markets.length) continue;
        picked.set(o.fixture.id, markets);
        daysUsed.add(day);
      }
      if (page >= (data.paging?.total ?? 1)) break;
    }
  }

  // Odds don't carry team names; free plan can't look up by id, so fetch the day's fixtures.
  const fixtures: any[] = [];
  for (const day of daysUsed) {
    fixtures.push(...((await apiGet(`/fixtures?date=${day}`)).response ?? []));
  }

  const upcoming = fixtures
    .filter((f: any) => picked.has(f.fixture.id))
    .map((f: any) => ({
      externalId: `af-${f.fixture.id}`,
      sport: "football",
      league: f.league.name,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      startTime: new Date(f.fixture.date),
      markets: picked.get(f.fixture.id) ?? [],
    }))
    .sort((a: OddsEvent, b: OddsEvent) => a.startTime.getTime() - b.startTime.getTime())
    .slice(0, UPCOMING_SIZE);

  const rank = (f: any) => {
    const i = POPULAR_LEAGUES.indexOf(f.league.id);
    return i === -1 ? POPULAR_LEAGUES.length : i;
  };
  const finished = fixtures
    .filter((f: any) => FINISHED.has(f.fixture.status.short))
    .sort((a: any, b: any) => rank(a) - rank(b) || b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, RESULTS_SIZE)
    .map((f: any) => ({
      externalId: `af-${f.fixture.id}`,
      league: f.league.name,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      startTime: new Date(f.fixture.date),
      status: f.fixture.status.short,
      homeGoals: f.goals.home,
      awayGoals: f.goals.away,
    }));

  return { upcoming, finished };
}

// Shared cache: serves fresh data within ttl, collapses concurrent refreshes,
// and falls back to the last good data when out of budget or on errors.
function cachedFeed<T>(ttl: number, reserve: number, load: () => Promise<T>) {
  let cache: { data: T; fetchedAt: number } | null = null;
  let inFlight: Promise<T> | null = null;
  let failure: { error: unknown; at: number } | null = null;

  return async () => {
    if (cache && Date.now() - cache.fetchedAt < ttl) return { ...cache, stale: false };
    // After a failed refresh, wait before spending more calls.
    if (failure && Date.now() - failure.at < ERROR_BACKOFF) {
      if (cache) return { ...cache, stale: true };
      throw failure.error;
    }
    if (!budgetLeft(reserve)) {
      if (cache) return { ...cache, stale: true };
      throw new Error("API-Football daily budget used up");
    }
    inFlight ??= load().finally(() => { inFlight = null; });
    try {
      cache = { data: await inFlight, fetchedAt: Date.now() };
      failure = null;
      return { ...cache, stale: false };
    } catch (err) {
      failure = { error: err, at: Date.now() };
      if (cache) return { ...cache, stale: true };
      throw err;
    }
  };
}

export const getLiveFixtures = cachedFeed(LIVE_TTL, UPCOMING_RESERVE, fetchLive);
// Upcoming games and today's results share one cached refresh.
export const getUpcomingAndResults = cachedFeed(UPCOMING_TTL, 0, fetchUpcoming);

export function getApiFootballUsage() {
  budgetLeft();
  return {
    ...usage,
    budget: DAILY_BUDGET,
    upcomingReserve: UPCOMING_RESERVE,
    liveCacheSeconds: LIVE_TTL / 1000,
    upcomingCacheSeconds: UPCOMING_TTL / 1000,
  };
}
