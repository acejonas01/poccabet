import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export type Dir = "up" | "down" | "";

export interface TCMatch {
  id: string;
  league: string;
  country: string;
  home: string;
  away: string;
  homeLogo: string;
  awayLogo: string;
  start: number;
  live: boolean;
  clock: string; // "67'" / "HT" (live only)
  hs: number;
  as: number;
  red: "home" | "away" | null;
  stats: { possession: [number, number]; shots: [number, number]; corners: [number, number] } | null;
  o: number[]; // 1X2 (0 = unavailable)
  ou: number[]; // Over / Under 2.5
  dirs: { "1x2": Dir[]; ou: Dir[] }; // last price movement, drives the flashing arrows
}

// Top leagues, in display order (desktop sidebar + "Top leagues" tab).
export const TOP_LEAGUES = ["Premier League", "Champions League", "La Liga", "Serie A", "Bundesliga", "NPFL"];
const LEAGUE_ORDER = ["Premier League", "Champions League", "UEFA Champions League", "La Liga", "Serie A", "Bundesliga", "Ligue 1", "NPFL"];
const COUNTRY: Record<string, string> = {
  "Premier League": "England", Championship: "England", "La Liga": "Spain", "Serie A": "Italy",
  Bundesliga: "Germany", "Ligue 1": "France", NPFL: "Nigeria", "Champions League": "Europe",
  "UEFA Champions League": "Europe", EPL: "England",
};

export function leagueRank(league: string) {
  const i = LEAGUE_ORDER.indexOf(league);
  return i === -1 ? LEAGUE_ORDER.length : i;
}

// ---------- normalising feed items ----------
function oneXTwo(markets: any[]): number[] {
  const mw = markets?.find((m: any) => m.type === "MATCH_WINNER" || m.type === "HEAD_TO_HEAD");
  const outs = mw?.outcomes ?? [];
  return outs.length === 3 ? outs.map((x: any) => Number(x.odds) || 0) : [0, 0, 0];
}
function overUnder25(markets: any[]): number[] {
  const ou = markets?.find((m: any) => m.type === "OVER_UNDER");
  const over = ou?.outcomes?.find((x: any) => /over/i.test(x.label) && x.label.includes("2.5"));
  const under = ou?.outcomes?.find((x: any) => /under/i.test(x.label) && x.label.includes("2.5"));
  return [Number(over?.odds) || 0, Number(under?.odds) || 0];
}
const noDirs = () => ({ "1x2": ["", "", ""] as Dir[], ou: ["", ""] as Dir[] });

function fromLive(f: any): TCMatch {
  return {
    id: `af-${f.externalId}`,
    league: f.league,
    country: f.country || COUNTRY[f.league] || "",
    home: f.homeTeam,
    away: f.awayTeam,
    homeLogo: f.homeLogo || "",
    awayLogo: f.awayLogo || "",
    start: new Date(f.startTime).getTime(),
    live: true,
    clock: f.status === "HT" ? "HT" : `${f.minute ?? 0}'`,
    hs: f.homeGoals ?? 0,
    as: f.awayGoals ?? 0,
    red: f.redCard ?? null,
    stats: f.stats ?? null,
    o: oneXTwo(f.markets),
    ou: overUnder25(f.markets),
    dirs: noDirs(),
  };
}

function fromUpcoming(e: any): TCMatch {
  return {
    id: e.externalId,
    league: e.league,
    country: e.country || COUNTRY[e.league] || "",
    home: e.homeTeam,
    away: e.awayTeam,
    homeLogo: e.homeLogo || "",
    awayLogo: e.awayLogo || "",
    start: new Date(e.startTime).getTime(),
    live: false,
    clock: "",
    hs: 0,
    as: 0,
    red: null,
    stats: null,
    o: oneXTwo(e.markets),
    ou: overUnder25(e.markets),
    dirs: noDirs(),
  };
}

// ---------- device cache (instant first paint; never required) ----------
function readCache(key: string, maxAge: number): TCMatch[] {
  try {
    const { at, data } = JSON.parse(localStorage.getItem(key) ?? "null") ?? {};
    return Array.isArray(data) && Date.now() - at < maxAge ? data : [];
  } catch {
    return [];
  }
}
function writeCache(key: string, data: TCMatch[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore
  }
}

// Mark which prices moved since the last refresh (up/down). Only an actual change sets a
// direction — unchanged prices get none, so the arrow flashes once per move, never on its own.
function withDirs(next: TCMatch[], prev: Map<string, TCMatch>) {
  return next.map((m) => {
    const before = prev.get(m.id);
    if (!before) return m;
    const d = (a: number, b: number): Dir => (a && b && a !== b ? (a > b ? "up" : "down") : "");
    return {
      ...m,
      dirs: {
        "1x2": m.o.map((v, i) => d(v, before.o[i])),
        ou: m.ou.map((v, i) => d(v, before.ou[i])),
      },
    };
  });
}

export function useTCData() {
  const [live, setLive] = useState<TCMatch[]>(() => readCache("pocca-c-live", 5 * 60000));
  const [upcoming, setUpcoming] = useState<TCMatch[]>(() => readCache("pocca-c-upcoming", 3 * 3600000));
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [upcomingLoaded, setUpcomingLoaded] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const liveRef = useRef(new Map<string, TCMatch>());
  const upcomingRef = useRef(new Map<string, TCMatch>());

  useEffect(() => {
    const load = () =>
      api
        .getLiveFixtures()
        .then((res) => {
          setSimulated(!!res.simulated);
          const next = withDirs(res.fixtures.map(fromLive), liveRef.current);
          liveRef.current = new Map(next.map((m) => [m.id, m]));
          writeCache("pocca-c-live", next);
          setLive(next);
        })
        .catch(() => {})
        .finally(() => setLiveLoaded(true));
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const load = () =>
      api
        .getUpcomingFixtures()
        .then((res) => {
          const next = withDirs(res.events.map(fromUpcoming).filter((m: TCMatch) => m.o[0] > 0), upcomingRef.current);
          upcomingRef.current = new Map(next.map((m) => [m.id, m]));
          writeCache("pocca-c-upcoming", next);
          setUpcoming(next);
        })
        .catch(() => {})
        .finally(() => setUpcomingLoaded(true));
    load();
    // Every minute: prices move pre-match too (the server caches, so this costs no API calls).
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  // Drop upcoming games once they kick off (the feed is cached for a while).
  const now = Date.now();
  return {
    live,
    upcoming: upcoming.filter((m) => m.start > now),
    liveLoaded,
    upcomingLoaded,
    simulated,
  };
}

// ---------- formatting ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const hhmm = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export function dayLabel(t: number) {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-GB", { weekday: "short" });
}
export const kickoff = (t: number) => `${dayLabel(t)} ${hhmm(t)}`;

// "Manchester City" → "MCI", "Real Madrid" → "RMA", "Sevilla" → "SEV"
export function teamCode(name: string) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !/^(fc|afc|cf|sc|ac)$/i.test(w));
  if (words.length === 0) return name.slice(0, 3).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return (words[0][0] + words[words.length - 1].slice(0, 2)).toUpperCase();
}

// Sections are keyed by country + league: many countries share league names
// ("Premier League" in England, Ghana, Ukraine…), and each division gets its own section.
export function groupByLeague(matches: TCMatch[]) {
  const map = new Map<string, TCMatch[]>();
  for (const m of matches) {
    const key = `${m.country}|${m.league}`;
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return [...map.values()]
    .map((list) => ({ key: `${list[0].country}|${list[0].league}`, name: list[0].league, country: (list[0].country || "").toUpperCase(), matches: list }))
    .sort((a, b) => leagueRank(a.name) - leagueRank(b.name) || a.name.localeCompare(b.name) || a.country.localeCompare(b.country));
}

// Date filter options: All dates, Today, Tomorrow, then the next two days ("Sat 26").
export function dateOptions() {
  const opts = [{ id: "all", label: "All dates" }];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${d.getDate()}`;
    opts.push({ id: d.toDateString(), label });
  }
  return opts;
}
export const matchesDate = (m: TCMatch, dateId: string) => dateId === "all" || new Date(m.start).toDateString() === dateId;

// URL slug for a league page, e.g. "England", "Premier League" → "england-premier-league".
// Country is included because different countries reuse names like "Premier League".
export const leagueSlug = (country: string, name: string) =>
  `${country} ${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Day heading for grouped lists: "Today", "Tomorrow", "Saturday 26 Sep".
export function dayHeading(t: number) {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === new Date(today.getTime() + 86400000).toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}
