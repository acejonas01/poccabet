// Pick of the day = today's most-picked selection (from bettors' slips) on a match that
// hasn't kicked off. Until anyone has picked, it falls back to the top match's favourite.
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { type TCMatch, kickoff } from "./data";
import { deriveOdds, marketDef } from "./markets";

export interface PickOfDay {
  m: TCMatch;
  title: string;
  sub: string;
  label: string; // "Liverpool to win"
  marketId: string;
  marketLabel: string;
  col: string;
  odds: number;
  note: string;
}

// Plain-English name for a selection: ("1x2", "1") → "Liverpool to win"
export function selectionLabel(market: string, col: string, home: string, away: string) {
  const side = (c: string) => (c === "1" ? home : c === "2" ? away : "Draw");
  switch (market) {
    case "1x2": return col === "X" ? "Draw" : `${side(col)} to win`;
    case "dc": return col === "1X" ? `${home} or draw` : col === "12" ? `${home} or ${away}` : `Draw or ${away}`;
    case "dnb": return `${side(col)} (draw no bet)`;
    case "ou15": return `${col} 1.5 goals`;
    case "ou": return `${col} 2.5 goals`;
    case "ou35": return `${col} 3.5 goals`;
    case "gg": return col === "GG" ? "Both teams to score" : "Not both teams to score";
    case "oe": return `${col} number of goals`;
    case "hc": return col.startsWith("1") ? `${home} −1 handicap` : col.startsWith("2") ? `${away} +1 handicap` : "Draw (−1 handicap)";
    case "ht": return col === "X" ? "Draw at half-time" : `${side(col)} to lead at half-time`;
    case "cs": return `Correct score ${col}`;
    default: return col;
  }
}

function build(m: TCMatch, marketId: string, col: string, note: string): PickOfDay | null {
  const def = marketDef(marketId);
  const i = def.cols.indexOf(col);
  const odds = i >= 0 ? deriveOdds(m.o, m.ou)[marketId]?.[i] ?? 0 : 0;
  if (!odds) return null;
  return {
    m,
    title: `${m.home} vs ${m.away}`,
    sub: `${m.country ? `${m.country} · ` : ""}${m.league} · ${kickoff(m.start)}`,
    label: selectionLabel(marketId, col, m.home, m.away),
    marketId,
    marketLabel: def.label,
    col,
    odds,
    note,
  };
}

// Crowd-pullers: the fallback pick is always a big-club match in a top league.
const POPULAR_CLUBS = [
  "Manchester City", "Arsenal", "Liverpool", "Manchester United", "Chelsea", "Real Madrid", "Barcelona",
  "Bayern Munich", "Paris Saint-Germain", "Juventus", "Inter", "AC Milan", "Tottenham", "Atletico Madrid",
  "Borussia Dortmund", "Newcastle", "Napoli",
];
const POPULAR_LEAGUES = ["Premier League", "Champions League", "UEFA Champions League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"];
const pull = (m: TCMatch) =>
  (POPULAR_LEAGUES.includes(m.league) ? 1 : 0) *
  ((POPULAR_CLUBS.includes(m.home) ? 1 : 0) + (POPULAR_CLUBS.includes(m.away) ? 1 : 0));

export function usePickOfTheDay(upcoming: TCMatch[], ranked: TCMatch | undefined): PickOfDay | null {
  const [top, setTop] = useState<any | null>(null);

  useEffect(() => {
    const load = () => api.getTopPick().then((r) => setTop(r.top)).catch(() => {});
    load();
    const id = setInterval(load, 2 * 60000);
    return () => clearInterval(id);
  }, []);

  if (top) {
    const m = upcoming.find((x) => x.id === top.matchId);
    if (m) {
      const n: number = top.count;
      const share = top.matchPicks ? Math.round((n / top.matchPicks) * 100) : 100;
      const p = build(m, top.market, top.selection,
        `${n.toLocaleString("en-US")} ${n === 1 ? "bettor is" : "bettors are"} backing this today — ${share}% of all picks on this match.`);
      if (p) return p;
    }
  }

  const fallback = [...upcoming].filter((m) => pull(m) > 0).sort((a, b) => pull(b) - pull(a) || a.start - b.start)[0] ?? ranked;
  if (!fallback) return null;
  const homeFav = fallback.o[0] <= fallback.o[2];
  return build(fallback, "1x2", homeFav ? "1" : "2",
    "Today's big match. Get your pick in early — the crowd's favourite takes this spot as the bets roll in.");
}
