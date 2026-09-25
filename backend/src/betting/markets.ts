// Markets the site offers and how their prices are worked out from a feed's 1X2 and O/U 2.5.
// This mirrors frontend/src/redesign/markets.ts (the prices shown on screen) — the server
// re-prices every bet with it, so the two must agree; markets.test.ts checks that they do.
// A real odds provider that sends every market itself replaces deriveOdds (see feed.ts).

export interface MarketDef {
  id: string;
  label: string;
  cols: string[];
}

export const MARKETS: MarketDef[] = [
  { id: "1x2", label: "1X2", cols: ["1", "X", "2"] },
  { id: "dc", label: "Double chance", cols: ["1X", "12", "X2"] },
  { id: "dnb", label: "Draw no bet", cols: ["1", "2"] },
  { id: "ou15", label: "O/U 1.5", cols: ["Over", "Under"] },
  { id: "ou", label: "O/U 2.5", cols: ["Over", "Under"] },
  { id: "ou35", label: "O/U 3.5", cols: ["Over", "Under"] },
  { id: "gg", label: "GG/NG", cols: ["GG", "NG"] },
  { id: "oe", label: "Odd/Even", cols: ["Odd", "Even"] },
  { id: "hc", label: "Handicap", cols: ["1 (-1)", "X (-1)", "2 (+1)"] },
  { id: "ht", label: "Halftime 1X2", cols: ["1", "X", "2"] },
  { id: "cs", label: "Correct score", cols: ["1-0", "1-1", "0-1", "2-1", "1-2"] },
];

export function marketById(id: string): MarketDef | undefined {
  return MARKETS.find((m) => m.id === id);
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function poisson(l: number, k: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-l) * l ** k) / f;
}

function goalsModel(o: number[], ou: number[]) {
  if (!ou[0] || !ou[1] || !o[0] || !o[2]) return null;
  const pOver = 1 / ou[0] / (1 / ou[0] + 1 / ou[1]);
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

// Every market's prices, one per column (0 = unavailable / suspended).
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
