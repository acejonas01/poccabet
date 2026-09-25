// Grading one selection from a final score. Pure, so every market's rules can be tested.
// The market ids and column labels are the ones in markets.ts.
export type Grade = "WON" | "LOST" | "VOID";

export interface Score { home: number; away: number; htHome: number | null; htAway: number | null }

const OU_LINES: Record<string, number> = { ou15: 1.5, ou: 2.5, ou35: 3.5 };

// null = can't grade from this score (e.g. half-time market but the source has no half-time score).
export function gradeSelection(market: string, selection: string, s: Score): Grade | null {
  const { home: h, away: a } = s;
  const result = h > a ? "1" : h < a ? "2" : "X";
  const win = (cond: boolean): Grade => (cond ? "WON" : "LOST");

  switch (market) {
    case "1x2":
      return win(selection === result);
    case "dc":
      return win(selection.includes(result)); // "1X" covers 1 and X, "12" covers 1 and 2, "X2" covers X and 2
    case "dnb":
      return result === "X" ? "VOID" : win(selection === result);
    case "ou15":
    case "ou":
    case "ou35":
      return win(selection === "Over" ? h + a > OU_LINES[market] : h + a < OU_LINES[market]);
    case "gg":
      return win(selection === "GG" ? h > 0 && a > 0 : h === 0 || a === 0);
    case "oe":
      return win(selection === "Odd" ? (h + a) % 2 === 1 : (h + a) % 2 === 0);
    case "hc": // home starts one goal down
      if (selection === "1 (-1)") return win(h - 1 > a);
      if (selection === "X (-1)") return win(h - 1 === a);
      if (selection === "2 (+1)") return win(a + 1 > h);
      return null;
    case "ht": {
      if (s.htHome === null || s.htAway === null) return null;
      const htResult = s.htHome > s.htAway ? "1" : s.htHome < s.htAway ? "2" : "X";
      return win(selection === htResult);
    }
    case "cs":
      return win(selection === `${h}-${a}`);
    default:
      return null;
  }
}

// A bet's outcome from its legs. Any lost leg loses the bet at once; otherwise it waits for
// every leg. Void legs count as odds 1.00; all legs void = stake back.
export function betOutcome(legs: { result: string; odds: number }[], stakeKobo: number):
  | { status: "PENDING" }
  | { status: "LOST"; payout: 0 }
  | { status: "WON" | "VOID"; payout: number } {
  if (legs.some((l) => l.result === "LOST")) return { status: "LOST", payout: 0 };
  if (legs.some((l) => l.result === "PENDING")) return { status: "PENDING" };
  if (legs.every((l) => l.result === "VOID")) return { status: "VOID", payout: stakeKobo };
  const odds = legs.reduce((acc, l) => acc * (l.result === "WON" ? l.odds : 1), 1);
  return { status: "WON", payout: Math.floor(stakeKobo * odds) };
}
