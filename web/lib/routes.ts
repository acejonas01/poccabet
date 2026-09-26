// Which URLs exist, so unknown ones get a real 404 (search engines drop them) instead of an
// empty page. Mirrors the routes in frontend/src/redesign/RedesignApp.tsx.
export const SPORT_NAMES: Record<string, string> = {
  football: "Football", basketball: "Basketball", tennis: "Tennis", "table-tennis": "Table Tennis",
  "ice-hockey": "Ice Hockey", volleyball: "Volleyball", baseball: "Baseball", "american-football": "American Football",
  boxing: "Boxing", darts: "Darts", cricket: "Cricket", efootball: "eFootball",
};
export const FOOTBALL_VIEWS = ["today", "live", "all", "soon", "filter"];
const PAGES = ["login", "signup", "betslip", "my-bets", "account"];

export type RouteCheck = { ok: true } | { redirect: string } | { notFound: true };

export function checkPath([first, second, third, ...rest]: string[]): RouteCheck {
  if (rest.length) return { notFound: true };
  if (!first) return { ok: true };
  if (first === "league") return second && !third ? { ok: true } : { notFound: true };
  if (first === "sports") {
    if (!second) return { redirect: "/sports/football" };
    if (!(second in SPORT_NAMES)) return { notFound: true };
    if (!third) return { ok: true };
    if (second !== "football") return { redirect: `/sports/${second}` };
    return FOOTBALL_VIEWS.includes(third) || /^\d{4}-\d{2}-\d{2}$/.test(third) ? { ok: true } : { redirect: "/sports/football" };
  }
  return PAGES.includes(first) && !second ? { ok: true } : { notFound: true };
}
