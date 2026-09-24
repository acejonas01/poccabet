// Markets offered in Theme C. 1X2 and O/U 2.5 come from the feed; the rest are derived
// from them with the design's own formulas (deriveOdds below is the design's logic).

export interface MarketDef {
  id: string;
  label: string;
  group: "MAIN" | "GOALS" | "HANDICAP" | "HALVES";
  cols: string[];
}

export const MK: MarketDef[] = [
  { id: "1x2", label: "1X2", group: "MAIN", cols: ["1", "X", "2"] },
  { id: "dc", label: "Double chance", group: "MAIN", cols: ["1X", "12", "X2"] },
  { id: "dnb", label: "Draw no bet", group: "MAIN", cols: ["1", "2"] },
  { id: "ou15", label: "O/U 1.5", group: "GOALS", cols: ["Over", "Under"] },
  { id: "ou", label: "O/U 2.5", group: "GOALS", cols: ["Over", "Under"] },
  { id: "ou35", label: "O/U 3.5", group: "GOALS", cols: ["Over", "Under"] },
  { id: "gg", label: "GG/NG", group: "GOALS", cols: ["GG", "NG"] },
  { id: "oe", label: "Odd/Even", group: "GOALS", cols: ["Odd", "Even"] },
  { id: "hc", label: "Handicap", group: "HANDICAP", cols: ["1 (-1)", "X (-1)", "2 (+1)"] },
  { id: "ht", label: "Halftime 1X2", group: "HALVES", cols: ["1", "X", "2"] },
];

// Mobile market tabs: these four always show; picking another from "More" swaps it into slot 4.
export const FIXED = ["1x2", "ou", "gg", "dc"];

// Desktop market pills; each shows one or more market groups side by side.
export const CORRECT_SCORE: MarketDef = { id: "cs", label: "Correct score", group: "MAIN", cols: ["1-0", "1-1", "0-1", "2-1", "1-2"] };
export const DESKTOP_PILLS = [
  { id: "main", label: "1X2 & O/U 2.5", markets: ["1x2", "ou"] },
  { id: "dc", label: "Double chance", markets: ["dc"] },
  { id: "gg", label: "GG/NG", markets: ["gg"] },
  { id: "hc", label: "Handicap", markets: ["hc"] },
  { id: "cs", label: "Correct score", markets: ["cs"] },
];

export function marketDef(id: string): MarketDef {
  return id === "cs" ? CORRECT_SCORE : MK.find((m) => m.id === id) ?? MK[0];
}

// Desktop column headers: the design writes "Over 2.5" / "Under 2.5" for the O/U 2.5 group.
export function desktopCols(id: string) {
  return id === "ou" ? ["Over 2.5", "Under 2.5"] : marketDef(id).cols;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function poisson(l: number, k: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-l) * l ** k) / f;
}

// GG/NG and correct score aren't in the feed: estimate them from the O/U 2.5 and 1X2 prices
// with a simple Poisson goals model.
function goalsModel(o: number[], ou: number[]) {
  if (!ou[0] || !ou[1] || !o[0] || !o[2]) return null;
  const pOver = 1 / ou[0] / (1 / ou[0] + 1 / ou[1]);
  // total-goals rate whose P(3+ goals) matches the O/U price
  let lo = 0.2, hi = 6;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p3 = 1 - poisson(mid, 0) - poisson(mid, 1) - poisson(mid, 2);
    if (p3 < pOver) lo = mid; else hi = mid;
  }
  const total = (lo + hi) / 2;
  const share = 1 / o[0] / (1 / o[0] + 1 / o[2]);
  const lh = total * (0.3 + 0.4 * share);
  return { lh, la: total - lh };
}

// The design's deriveOdds, plus GG/NG and correct score estimated from the goals model.
// A 0 means the market is unavailable (shown locked).
export function deriveOdds(o: number[], ou: number[]): Record<string, number[]> {
  const p = o.map((x) => (x ? 1 / x : 0));
  const s = p[0] + p[1] + p[2] || 1;
  const inv = (v: number) => (v ? Math.max(1.01, r2(0.94 / v)) : 0);
  const z = (x: number, f: (x: number) => number) => (x ? f(x) : 0);
  const has1x2 = !!(o[0] && o[1] && o[2]);

  const model = goalsModel(o, ou);
  let gg = [0, 0];
  let cs = [0, 0, 0, 0, 0];
  if (model) {
    const pGG = (1 - poisson(model.lh, 0)) * (1 - poisson(model.la, 0));
    gg = [inv(pGG), inv(1 - pGG)];
    const score = (h: number, a: number) => Math.min(99, Math.max(1.01, r2(0.88 / (poisson(model.lh, h) * poisson(model.la, a)))));
    cs = [score(1, 0), score(1, 1), score(0, 1), score(2, 1), score(1, 2)];
  }

  return {
    "1x2": o,
    ou,
    gg,
    cs,
    dc: has1x2 ? [inv((p[0] + p[1]) / s), inv((p[0] + p[2]) / s), inv((p[1] + p[2]) / s)] : [0, 0, 0],
    dnb: has1x2 ? [inv(p[0] / (p[0] + p[2] || 1)), inv(p[2] / (p[0] + p[2] || 1))] : [0, 0],
    ou15: [z(ou[0], (x) => Math.max(1.05, r2(x * 0.7))), z(ou[1], (x) => r2(x * 1.6))],
    ou35: [z(ou[0], (x) => r2(x * 1.75)), z(ou[1], (x) => Math.max(1.05, r2(x * 0.68)))],
    oe: [z(o[0], (x) => r2(1.85 + ((x * 7) % 10) / 100)), z(o[0], (x) => r2(1.95 - ((x * 7) % 10) / 100))],
    hc: [z(o[0], (x) => r2(x * 1.9)), z(o[1], (x) => r2(Math.max(3.4, x))), z(o[2], (x) => r2(Math.max(1.15, x / 2.2)))],
    ht: [z(o[0], (x) => r2(x * 1.35 + 0.2)), z(o[1], (x) => r2(Math.max(1.9, x * 0.6))), z(o[2], (x) => r2(x * 1.3 + 0.3))],
  };
}

// Markets a match actually offers — drives the "+N markets" links.
export function marketCount(o: number[], ou: number[]) {
  // Suspended in-play markets still count — they reopen after the lock.
  if (!o[0] && !ou[0]) return MK.length + 1;
  const all = deriveOdds(o, ou);
  return [...MK, CORRECT_SCORE].filter((m) => (all[m.id] ?? []).some((v) => v > 0)).length;
}

// "Chance implied by odds" (the design's featured-card bars): normalised 1/odds, summing to 100.
export function impliedPct(o: number[]) {
  const p = o.map((x) => (x ? 1 / x : 0));
  const s = p[0] + p[1] + p[2] || 1;
  const pct = p.map((x) => Math.round((x / s) * 100));
  pct[2] = 100 - pct[0] - pct[1];
  return pct;
}
