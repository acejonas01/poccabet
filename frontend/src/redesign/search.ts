// Search over the feed: live and upcoming matches, teams, leagues (and divisions) and countries.
// Words match from their start ("ars" → Arsenal), every typed word must match, small typos are
// forgiven ("arsnal"), and common nicknames work ("man utd", "spurs", "barca", "epl"…).
import { type TCMatch, leagueRank, leagueSlug } from "./data";
import { POPULAR_CLUBS } from "./potd";

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Nicknames and short forms → the words the feed uses.
const ALIASES: Record<string, string> = {
  "man utd": "manchester united", "man u": "manchester united", "man united": "manchester united", "mufc": "manchester united",
  "man city": "manchester city", "mcfc": "manchester city", "city": "manchester city",
  spurs: "tottenham", gunners: "arsenal", "the reds": "liverpool", blues: "chelsea", toffees: "everton", villa: "aston villa",
  "west brom": "west bromwich", wolves: "wolverhampton", forest: "nottingham forest", "nottm forest": "nottingham forest",
  barca: "barcelona", "real": "real madrid", atleti: "atletico madrid", "atletico": "atletico madrid",
  juve: "juventus", "ac milan": "milan", "inter milan": "inter", bayern: "bayern munich", "bvb": "borussia dortmund",
  dortmund: "borussia dortmund", psg: "paris saint germain", "paris sg": "paris saint germain",
  epl: "premier league", "prem": "premier league", ucl: "champions league", "uefa": "champions league", laliga: "la liga",
  bundes: "bundesliga", "serie a": "serie a", "ligue 1": "ligue 1", nigeria: "nigeria", "super eagles": "nigeria",
};

const words = (s: string) => normalize(s).split(" ").filter(Boolean);

// Up to one typo (swap, missing, extra or wrong letter) for words of 4+ letters.
function nearly(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; continue; } // swapped pair
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// How well one typed word matches one word of the text: 3 whole word, 2 start of word, 1 typo, 0 none.
function wordScore(q: string, w: string) {
  if (w === q) return 3;
  if (w.startsWith(q)) return 2;
  if (q.length >= 4 && (nearly(q, w) || nearly(q, w.slice(0, q.length)))) return 1;
  return 0;
}

// Score a text for a query (0 = no match). Every typed word must match some word of the text.
export function scoreText(text: string, query: string): number {
  const tw = words(text);
  const qw = words(query);
  if (!qw.length || !tw.length) return 0;
  let total = 0;
  for (const q of qw) {
    let best = 0;
    for (const w of tw) best = Math.max(best, wordScore(q, w));
    if (!best) return 0;
    total += best;
  }
  const nt = normalize(text), nq = normalize(query);
  if (nt === nq) total += 10;
  else if (nt.startsWith(nq)) total += 5;
  return total;
}

// The query plus the full name behind a nickname ("spurs" → also "tottenham").
function variants(query: string) {
  const n = normalize(query);
  const out = [n];
  for (const [alias, full] of Object.entries(ALIASES)) {
    if (alias === n || (n.length >= 3 && alias.startsWith(n) && alias.length - n.length <= 2)) out.push(full);
  }
  return [...new Set(out)];
}
const bestScore = (text: string, qs: string[]) => Math.max(0, ...qs.map((q) => scoreText(text, q)));

export interface TeamHit { name: string; logo: string; country: string; league: string; live?: TCMatch; next?: TCMatch; count: number; score: number }
export interface LeagueHit { name: string; country: string; slug: string; live: number; count: number; score: number }
export interface MatchHit { m: TCMatch; score: number }
export interface SearchResults { teams: TeamHit[]; leagues: LeagueHit[]; live: MatchHit[]; upcoming: MatchHit[]; total: number }

// Teams and leagues found in the feed (built once per feed change).
export function buildIndex(live: TCMatch[], upcoming: TCMatch[]) {
  const teams = new Map<string, Omit<TeamHit, "score">>();
  const leagues = new Map<string, Omit<LeagueHit, "score">>();
  for (const m of [...live, ...upcoming]) {
    for (const [name, logo] of [[m.home, m.homeLogo], [m.away, m.awayLogo]] as const) {
      const t = teams.get(name) ?? { name, logo, country: m.country, league: m.league, count: 0 };
      t.count++;
      if (m.live) t.live ??= m;
      else if (!t.next || m.start < t.next.start) t.next = m;
      if (!t.logo && logo) t.logo = logo;
      teams.set(name, t);
    }
    const slug = leagueSlug(m.country, m.league);
    const l = leagues.get(slug) ?? { name: m.league, country: m.country, slug, live: 0, count: 0 };
    l.count++;
    if (m.live) l.live++;
    leagues.set(slug, l);
  }
  return { teams: [...teams.values()], leagues: [...leagues.values()], live, upcoming };
}
export type SearchIndex = ReturnType<typeof buildIndex>;

const matchText = (m: TCMatch) => `${m.home} ${m.away} ${m.league} ${m.country}`;
const popular = (name: string) => (POPULAR_CLUBS.includes(name) ? 2 : 0);

export function search(index: SearchIndex, query: string, limits = { teams: 5, leagues: 4, live: 4, upcoming: 6 }): SearchResults {
  const qs = variants(query);
  if (!normalize(query)) return { teams: [], leagues: [], live: [], upcoming: [], total: 0 };

  const teams = index.teams
    .map((t) => ({ ...t, score: bestScore(t.name, qs) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || Number(!!b.live) - Number(!!a.live) || popular(b.name) - popular(a.name) || leagueRank(a.league) - leagueRank(b.league) || b.count - a.count);
  const leagues = index.leagues
    .map((l) => ({ ...l, score: Math.max(bestScore(`${l.name} ${l.country}`, qs), bestScore(l.name, qs) + 1) }))
    .filter((l) => l.score > 1)
    .sort((a, b) => b.score - a.score || leagueRank(a.name) - leagueRank(b.name) || b.count - a.count);
  const matches = (list: TCMatch[]) => list
    .map((m) => ({ m, score: Math.max(bestScore(m.home, qs) + 2, bestScore(m.away, qs) + 2, bestScore(matchText(m), qs)) }))
    .filter((h) => h.score > 2)
    .sort((a, b) => b.score - a.score || leagueRank(a.m.league) - leagueRank(b.m.league) || a.m.start - b.m.start);
  const live = matches(index.live);
  const upcoming = matches(index.upcoming);
  return {
    teams: teams.slice(0, limits.teams), leagues: leagues.slice(0, limits.leagues),
    live: live.slice(0, limits.live), upcoming: upcoming.slice(0, limits.upcoming),
    total: live.length + upcoming.length,
  };
}

// Every match for the results page, live first, then by kick-off.
export function searchMatches(index: SearchIndex, query: string) {
  const r = search(index, query, { teams: 0, leagues: 0, live: 999, upcoming: 999 });
  return { live: r.live.map((h) => h.m), upcoming: r.upcoming.map((h) => h.m).sort((a, b) => a.start - b.start) };
}

// Parts of `text` to show bold: the letters that matched the start of a word.
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const qw = variants(query).flatMap(words);
  if (!qw.length) return [{ text, hit: false }];
  const out: { text: string; hit: boolean }[] = [];
  const re = /[A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+/g;
  for (const piece of text.match(re) ?? [text]) {
    const n = normalize(piece);
    const q = n ? qw.filter((x) => n.startsWith(x)).sort((a, b) => b.length - a.length)[0] : undefined;
    if (q) {
      out.push({ text: piece.slice(0, q.length), hit: true });
      if (piece.length > q.length) out.push({ text: piece.slice(q.length), hit: false });
    } else out.push({ text: piece, hit: false });
  }
  return out;
}

// Recent searches, kept on the device.
const RECENT_KEY = "pocca-recent-searches";
export function recentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 6); } catch { return []; }
}
export function rememberSearch(q: string) {
  const v = q.trim();
  if (!v) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([v, ...recentSearches().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6))); } catch { /* ignore */ }
}
export function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}
