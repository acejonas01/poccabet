export const ALL_COLUMNS = [
  { key: "home", label: "1", type: "mw" },
  { key: "draw", label: "X", type: "mw", gold: true },
  { key: "away", label: "2", type: "mw" },
  { key: "dc1x", label: "1X", type: "dc", gold: true },
  { key: "dc12", label: "12", type: "dc" },
  { key: "dc2x", label: "2X", type: "dc", gold: true },
  { key: "over", label: "over", type: "ou" },
  { key: "under", label: "Under", type: "ou" },
];

export const LEAGUE_COUNTRY: Record<string, { country: string; flag: string }> = {
  NPFL: { country: "Nigeria", flag: "🇳🇬" },
  "English Premier League": { country: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "La Liga": { country: "Spain", flag: "🇪🇸" },
  "Serie A": { country: "Italy", flag: "🇮🇹" },
  "UEFA Champions League": { country: "Europe", flag: "🇪🇺" },
  "International Friendly": { country: "International", flag: "🌍" },
  NBA: { country: "USA", flag: "🇺🇸" },
  "ATP Masters": { country: "International", flag: "🌍" },
};

export function getEventCode(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 90000) + 10000;
}

function doubleChance(a: any, b: any, id: string, label: string) {
  if (!a || !b) return null;
  const odds = 1 / (1 / a.odds + 1 / b.odds);
  return { id, label, odds: Math.round(odds * 100) / 100 };
}

// Placeholder until the seed carries Over/Under for every sport.
function placeholderOutcome(id: string, label: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const odds = 1.5 + (Math.abs(hash) % 110) / 100;
  return { id, label, odds: Math.round(odds * 100) / 100 };
}

export function getOdds(event: any) {
  const mw = event.markets.find(
    (m: any) => m.type === "MATCH_WINNER" || m.type === "HEAD_TO_HEAD"
  );
  const ou = event.markets.find((m: any) => m.type === "OVER_UNDER");
  const outcomes = mw?.outcomes ?? [];
  const home = outcomes[0] ?? null;
  const draw = outcomes.length === 3 ? outcomes[1] : null;
  const away = outcomes[outcomes.length - 1] ?? null;

  // Real in-play games never get made-up placeholder odds.
  const placeholder = (id: string, label: string) =>
    event.status === "LIVE" ? null : placeholderOutcome(id, label);

  return {
    home,
    draw,
    away,
    dc1x: doubleChance(home, draw, `${event.id}-dc1x`, "1X"),
    dc12: doubleChance(home, away, `${event.id}-dc12`, "12"),
    dc2x: doubleChance(draw, away, `${event.id}-dc2x`, "2X"),
    over:
      ou?.outcomes?.find((o: any) => o.label.includes("Over")) ??
      placeholder(`${event.id}-over`, "Over 2.5"),
    under:
      ou?.outcomes?.find((o: any) => o.label.includes("Under")) ??
      placeholder(`${event.id}-under`, "Under 2.5"),
  };
}

export function marketFor(event: any, marketType: string) {
  return marketType === "ou"
    ? event.markets.find((m: any) => m.type === "OVER_UNDER")
    : event.markets.find(
        (m: any) => m.type === "MATCH_WINNER" || m.type === "HEAD_TO_HEAD"
      );
}
