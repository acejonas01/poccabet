// Simulated football feed — used while no real data provider is available (FEED_MODE=simulation).
// Everything is derived from the UTC date + current time with a seeded RNG, so every server
// (laptop, Render) shows the same games, and restarts don't reshuffle anything. Costs 0 API calls.
//
// Model: a match kicks off every SLOT_MINUTES around the clock (so something is always live).
// Goals are pre-drawn from a Poisson model of team strength; the clock maps real time since
// kickoff to match minutes (45' + 15' half-time + 45'). Odds come from the same model, and
// live odds are recomputed from the score and time left. Markets lock for 2 minutes after a goal.

import type { OddsEvent, OddsMarket } from "./types";
import type { FinishedFixture, LiveFixture } from "./apifootball";

const SLOT_MINUTES = 15;
const MARGIN = 0.06; // bookmaker margin baked into odds
const MAX_ODDS = 51; // bookmakers cap long shots
const UPCOMING_SIZE = 30;
const RESULTS_SIZE = 30;
const LOCK_AFTER_GOAL_MIN = 2;

// Teams listed strongest first; strength is derived from position.
const LEAGUES: { id: number; name: string; country: string; teams: string[] }[] = [
  { id: 39, name: "Premier League", country: "England", teams: ["Manchester City", "Arsenal", "Liverpool", "Chelsea", "Tottenham", "Newcastle", "Manchester United", "Aston Villa", "Brighton", "West Ham", "Crystal Palace", "Fulham", "Brentford", "Everton", "Wolves", "Nottingham Forest", "Bournemouth", "Leeds United", "Burnley", "Sunderland"] },
  { id: 140, name: "La Liga", country: "Spain", teams: ["Real Madrid", "Barcelona", "Atletico Madrid", "Athletic Club", "Real Sociedad", "Villarreal", "Real Betis", "Girona", "Sevilla", "Valencia", "Celta Vigo", "Osasuna", "Getafe", "Mallorca", "Rayo Vallecano", "Alaves"] },
  { id: 135, name: "Serie A", country: "Italy", teams: ["Inter", "Napoli", "Juventus", "AC Milan", "Atalanta", "Roma", "Lazio", "Fiorentina", "Bologna", "Torino", "Udinese", "Genoa"] },
  { id: 78, name: "Bundesliga", country: "Germany", teams: ["Bayern Munich", "Bayer Leverkusen", "Borussia Dortmund", "RB Leipzig", "Stuttgart", "Eintracht Frankfurt", "Freiburg", "Wolfsburg", "Hoffenheim", "Werder Bremen", "Mainz", "Union Berlin"] },
  { id: 61, name: "Ligue 1", country: "France", teams: ["Paris Saint-Germain", "Monaco", "Marseille", "Lille", "Lyon", "Nice", "Lens", "Rennes"] },
  { id: 399, name: "NPFL", country: "Nigeria", teams: ["Enyimba", "Rivers United", "Remo Stars", "Enugu Rangers", "Shooting Stars", "Kano Pillars", "Plateau United", "Kwara United", "Bendel Insurance", "Lobi Stars", "Abia Warriors", "Sunshine Stars"] },
];

// API-Football team ids → crest images on its public media server (no API key or quota needed).
// NPFL clubs aren't mapped, so they fall back to the 3-letter badge.
const TEAM_IDS: Record<string, number> = {
  "Manchester United": 33, Newcastle: 34, Bournemouth: 35, Fulham: 36, Wolves: 39, Liverpool: 40, Arsenal: 42,
  Burnley: 44, Everton: 45, Tottenham: 47, "West Ham": 48, Chelsea: 49, "Manchester City": 50, Brighton: 51,
  "Crystal Palace": 52, Brentford: 55, "Leeds United": 63, "Nottingham Forest": 65, "Aston Villa": 66, Sunderland: 746,
  Barcelona: 529, "Atletico Madrid": 530, "Athletic Club": 531, Valencia: 532, Villarreal: 533, Sevilla: 536,
  "Celta Vigo": 538, "Real Madrid": 541, Alaves: 542, "Real Betis": 543, Getafe: 546, Girona: 547,
  "Real Sociedad": 548, Osasuna: 727, "Rayo Vallecano": 728, Mallorca: 798,
  Lazio: 487, "AC Milan": 489, Napoli: 492, Udinese: 494, Genoa: 495, Juventus: 496, Roma: 497, Atalanta: 499,
  Bologna: 500, Fiorentina: 502, Torino: 503, Inter: 505,
  "Bayern Munich": 157, Freiburg: 160, Wolfsburg: 161, "Werder Bremen": 162, Mainz: 164, "Borussia Dortmund": 165,
  Hoffenheim: 167, "Bayer Leverkusen": 168, "Eintracht Frankfurt": 169, Stuttgart: 172, "RB Leipzig": 173, "Union Berlin": 182,
  Lille: 79, Lyon: 80, Marseille: 81, Nice: 84, "Paris Saint-Germain": 85, Monaco: 91, Rennes: 94, Lens: 116,
};
const crest = (team: string) => (TEAM_IDS[team] ? `https://media.api-sports.io/football/teams/${TEAM_IDS[team]}.png` : "");

interface SimMatch {
  id: number;
  league: (typeof LEAGUES)[number];
  home: string;
  away: string;
  kickoff: number; // ms
  lambdaHome: number;
  lambdaAway: number;
  goals: { minute: number; side: "home" | "away" }[];
  redCard: { minute: number; side: "home" | "away" } | null;
  possessionHome: number; // % over the match
  shotRate: [number, number]; // shots per 90'
  cornerRate: [number, number];
}

// ---------- seeded randomness ----------
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poissonSample(lambda: number, rand: () => number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= rand(); } while (p > l);
  return k - 1;
}
function poissonPmf(lambda: number, k: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * lambda ** k) / f;
}

// ---------- schedule ----------
const dayCache = new Map<string, SimMatch[]>();

function strength(league: (typeof LEAGUES)[number], team: string) {
  const pos = league.teams.indexOf(team) / (league.teams.length - 1); // 0 strongest .. 1 weakest
  return 1.4 - 0.8 * pos; // 1.4 .. 0.6
}

function scheduleFor(day: string): SimMatch[] {
  const cached = dayCache.get(day);
  if (cached) return cached;

  const rand = rng(hash(`pocca-sim-${day}`));
  const dayStart = Date.parse(`${day}T00:00:00Z`);
  const lastPlayed = new Map<string, number>();
  const matches: SimMatch[] = [];

  for (let slot = 0; slot < (24 * 60) / SLOT_MINUTES; slot++) {
    const kickoff = dayStart + slot * SLOT_MINUTES * 60000;
    const league = LEAGUES[Math.floor(rand() * LEAGUES.length)];
    // A team plays at most once every 4 hours.
    const free = league.teams.filter((t) => kickoff - (lastPlayed.get(t) ?? -Infinity) > 4 * 3600000);
    if (free.length < 2) continue;
    const hi = Math.floor(rand() * free.length);
    let ai = Math.floor(rand() * (free.length - 1));
    if (ai >= hi) ai++;
    const home = free[hi];
    const away = free[ai];
    lastPlayed.set(home, kickoff);
    lastPlayed.set(away, kickoff);

    const sh = strength(league, home);
    const sa = strength(league, away);
    const lambdaHome = Math.min(3.2, Math.max(0.3, 1.45 * (sh / sa)));
    const lambdaAway = Math.min(3.2, Math.max(0.3, 1.1 * (sa / sh)));

    const goals: SimMatch["goals"] = [];
    for (let i = poissonSample(lambdaHome, rand); i > 0; i--) goals.push({ minute: 1 + Math.floor(rand() * 90), side: "home" });
    for (let i = poissonSample(lambdaAway, rand); i > 0; i--) goals.push({ minute: 1 + Math.floor(rand() * 90), side: "away" });
    goals.sort((a, b) => a.minute - b.minute);

    // ~1 in 6 matches has a red card.
    const redCard = rand() < 0.17 ? { minute: 10 + Math.floor(rand() * 78), side: (rand() < 0.5 ? "home" : "away") as "home" | "away" } : null;
    const possessionHome = Math.round(Math.min(68, Math.max(32, 50 + (sh - sa) * 22 + (rand() - 0.5) * 10)));
    const shotRate: [number, number] = [Math.round(6 + lambdaHome * 5 + rand() * 4), Math.round(5 + lambdaAway * 5 + rand() * 4)];
    const cornerRate: [number, number] = [Math.round(3 + lambdaHome * 2 + rand() * 3), Math.round(2 + lambdaAway * 2 + rand() * 3)];

    matches.push({
      id: hash(`${day}-${slot}`) % 90000000 + 10000000,
      league, home, away, kickoff, lambdaHome, lambdaAway, goals,
      redCard, possessionHome, shotRate, cornerRate,
    });
  }

  dayCache.set(day, matches);
  if (dayCache.size > 4) dayCache.delete(dayCache.keys().next().value!);
  return matches;
}

function isoDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

// ---------- match clock ----------
// Real minutes since kickoff → match state. 1H: 0–45, HT: 45–60, 2H: 60–105, then FT.
function clock(m: SimMatch, now: number) {
  const e = (now - m.kickoff) / 60000;
  if (e < 0) return { status: "NS", minute: null as number | null };
  if (e < 45) return { status: "1H", minute: Math.floor(e) + 1 };
  if (e < 60) return { status: "HT", minute: 45 };
  if (e < 105) return { status: "2H", minute: Math.floor(e - 60) + 46 };
  return { status: "FT", minute: 90 };
}

function realMinuteOfGoal(matchMinute: number) {
  return matchMinute <= 45 ? matchMinute - 1 : matchMinute - 46 + 60;
}

function scoreAt(m: SimMatch, minute: number) {
  let home = 0;
  let away = 0;
  for (const g of m.goals) {
    if (g.minute > minute) break;
    if (g.side === "home") home++;
    else away++;
  }
  return { home, away };
}

// ---------- odds ----------
function toOdds(p: number) {
  if (p <= 0.001) return MAX_ODDS;
  return Math.min(MAX_ODDS, Math.max(1.01, Math.round((1 / (p * (1 + MARGIN))) * 100) / 100));
}

function markets(m: SimMatch, minute: number, homeGoals: number, awayGoals: number): OddsMarket[] {
  const left = Math.max(0, (90 - minute) / 90);
  const lh = m.lambdaHome * left;
  const la = m.lambdaAway * left;
  let pH = 0, pD = 0, pA = 0, pOver = 0;
  for (let x = 0; x <= 8; x++) {
    for (let y = 0; y <= 8; y++) {
      const p = poissonPmf(lh, x) * poissonPmf(la, y);
      const h = homeGoals + x;
      const a = awayGoals + y;
      if (h > a) pH += p; else if (h === a) pD += p; else pA += p;
      if (h + a >= 3) pOver += p;
    }
  }
  const out: OddsMarket[] = [{
    type: "MATCH_WINNER",
    name: "Match Winner",
    outcomes: [
      { label: "Home", odds: toOdds(pH) },
      { label: "Draw", odds: toOdds(pD) },
      { label: "Away", odds: toOdds(pA) },
    ],
  }];
  // Once 3+ goals are in, Over 2.5 is settled — no market.
  if (homeGoals + awayGoals < 3) {
    out.push({
      type: "OVER_UNDER",
      name: "Over/Under",
      outcomes: [
        { label: "Over 2.5", odds: toOdds(pOver) },
        { label: "Under 2.5", odds: toOdds(1 - pOver) },
      ],
    });
  }
  return out;
}

// ---------- public feeds (same shapes as the real providers) ----------
export function simLive(now = Date.now()): LiveFixture[] {
  const candidates = [...scheduleFor(isoDay(now - 86400000)), ...scheduleFor(isoDay(now))];
  return candidates
    .map((m) => ({ m, c: clock(m, now) }))
    .filter(({ c }) => c.status === "1H" || c.status === "HT" || c.status === "2H")
    .map(({ m, c }) => {
      const minute = c.minute ?? 0;
      const score = scoreAt(m, minute);
      const sinceKickoff = (now - m.kickoff) / 60000;
      const justScored = m.goals.some((g) => {
        const d = sinceKickoff - realMinuteOfGoal(g.minute);
        return g.minute <= minute && d >= 0 && d < LOCK_AFTER_GOAL_MIN;
      });
      return {
        externalId: m.id,
        league: m.league.name,
        country: m.league.country,
        leagueLogo: "",
        homeTeam: m.home,
        awayTeam: m.away,
        homeLogo: crest(m.home),
        awayLogo: crest(m.away),
        homeGoals: score.home,
        awayGoals: score.away,
        status: c.status,
        minute,
        startTime: new Date(m.kickoff),
        // Markets lock after a goal and in the last minutes.
        markets: justScored || minute >= 88 ? [] : markets(m, minute, score.home, score.away),
        stats: {
          possession: [m.possessionHome, 100 - m.possessionHome] as [number, number],
          shots: [Math.round((m.shotRate[0] * minute) / 90), Math.round((m.shotRate[1] * minute) / 90)] as [number, number],
          corners: [Math.round((m.cornerRate[0] * minute) / 90), Math.round((m.cornerRate[1] * minute) / 90)] as [number, number],
        },
        redCard: m.redCard && m.redCard.minute <= minute ? m.redCard.side : null,
      };
    })
    .sort((a, b) => (b.minute ?? 0) - (a.minute ?? 0));
}

export function simUpcoming(now = Date.now()): OddsEvent[] {
  const soon = now + 5 * 60000;
  return [...scheduleFor(isoDay(now)), ...scheduleFor(isoDay(now + 86400000))]
    .filter((m) => m.kickoff > soon)
    .slice(0, UPCOMING_SIZE)
    .map((m) => ({
      externalId: `af-${m.id}`,
      sport: "football",
      league: m.league.name,
      country: m.league.country,
      homeTeam: m.home,
      awayTeam: m.away,
      homeLogo: crest(m.home),
      awayLogo: crest(m.away),
      startTime: new Date(m.kickoff),
      markets: markets(m, 0, 0, 0),
    }));
}

// ---------- simulated "pick of the day" (stands in for real bettor picks) ----------
// Big clubs draw the crowd; the busiest upcoming match among them gets today's top pick.
const POPULAR_CLUBS: Record<string, number> = {
  "Manchester City": 10, Arsenal: 10, Liverpool: 10, "Manchester United": 10, Chelsea: 9, "Real Madrid": 10,
  Barcelona: 10, "Bayern Munich": 8, "Paris Saint-Germain": 8, Juventus: 7, Inter: 7, "AC Milan": 7, Tottenham: 6,
  "Atletico Madrid": 6, "Borussia Dortmund": 6, Newcastle: 5, "Aston Villa": 4, Napoli: 5, "Bayer Leverkusen": 4,
};
const POPULAR_LEAGUES = ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];

export function simTopPick(now = Date.now()) {
  const soon = now + 5 * 60000;
  // Same window as simUpcoming, so the app always has this match's odds.
  const pool = [...scheduleFor(isoDay(now)), ...scheduleFor(isoDay(now + 86400000))]
    .filter((m) => m.kickoff > soon)
    .slice(0, UPCOMING_SIZE)
    .filter((m) => POPULAR_LEAGUES.includes(m.league.name))
    .map((m) => ({ m, pull: (POPULAR_CLUBS[m.home] ?? 0) + (POPULAR_CLUBS[m.away] ?? 0) }))
    .filter((x) => x.pull > 0)
    .sort((a, b) => b.pull - a.pull || a.m.kickoff - b.m.kickoff);
  if (!pool.length) return null;

  const { m, pull } = pool[0];
  const rand = rng(hash(`pocca-pick-${isoDay(now)}-${m.id}`));
  const odds = markets(m, 0, 0, 0);
  const [h, , a] = odds[0].outcomes.map((o) => o.odds);
  const homeStar = (POPULAR_CLUBS[m.home] ?? 0) >= (POPULAR_CLUBS[m.away] ?? 0);
  const starOdds = homeStar ? h : a;

  // The crowd backs the big club to win unless it's a clear underdog; then it goes for goals.
  let market = "1x2";
  let selection = homeStar ? "1" : "2";
  if (starOdds > 3.2) {
    market = rand() < 0.5 ? "ou" : "gg";
    selection = market === "ou" ? "Over" : "GG";
  }

  // Counts build through the day.
  const dayStart = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const elapsed = Math.min(1, (now - dayStart) / 86400000);
  const base = 60 * pull + Math.floor(rand() * 900);
  const count = Math.max(12, Math.round(base * (0.25 + 0.75 * elapsed)));
  const share = 0.48 + rand() * 0.24;

  return {
    matchId: `af-${m.id}`,
    market,
    selection,
    count,
    matchPicks: Math.round(count / share),
    home: m.home,
    away: m.away,
    league: m.league.name,
    country: m.league.country,
    homeLogo: crest(m.home),
    awayLogo: crest(m.away),
    kickoff: new Date(m.kickoff),
  };
}

export function simResults(now = Date.now()): FinishedFixture[] {
  const popular = LEAGUES.map((l) => l.id);
  return scheduleFor(isoDay(now))
    .filter((m) => clock(m, now).status === "FT")
    .sort((a, b) => popular.indexOf(a.league.id) - popular.indexOf(b.league.id) || b.kickoff - a.kickoff)
    .slice(0, RESULTS_SIZE)
    .map((m) => {
      const s = scoreAt(m, 90);
      return {
        externalId: `af-${m.id}`,
        league: m.league.name,
        homeTeam: m.home,
        awayTeam: m.away,
        startTime: new Date(m.kickoff),
        status: "FT",
        homeGoals: s.home,
        awayGoals: s.away,
      };
    });
}
