// Titles and descriptions for each page (what search results and link previews show).
import type { Metadata } from "next";
import type { InitialFeed } from "../../frontend/src/redesign/data";
import { leaguesIn } from "./feed";
import { SPORT_NAMES } from "./routes";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://poccabet.vercel.app").replace(/\/$/, "");
const BRAND = "Poccabet";

const fixtureLine = (m: { home: string; away: string }[]) =>
  m.slice(0, 3).map((x) => `${x.home} vs ${x.away}`).join(", ");

export function metadataFor(path: string[], feed: InitialFeed | null): Metadata {
  const url = `${SITE}/${path.join("/")}`.replace(/\/$/, "") || SITE;
  // card: the big and small lines on the link preview image (/og).
  const base = (title: string, description: string, index = true, card?: [string, string]): Metadata => {
    const image = { url: `${SITE}/og?${new URLSearchParams(card ? { t: card[0], s: card[1] } : {})}`, width: 1200, height: 630, alt: title };
    return {
      title,
      description,
      alternates: { canonical: url },
      robots: index ? undefined : { index: false, follow: true },
      openGraph: { title, description, url, siteName: BRAND, type: "website", locale: "en_NG", images: [image] },
      twitter: { card: "summary_large_image", title, description, images: [image.url] },
    };
  };
  const [first, second, third] = path;

  if (!first) {
    const next = feed?.upcoming?.slice(0, 3).map((e: any) => ({ home: e.homeTeam, away: e.awayTeam })) ?? [];
    return base(
      `${BRAND} — Football betting odds, live scores & more`,
      `Bet on today's football with ${BRAND}: live odds, in-play scores, accumulators and booking codes.${next.length ? ` Up next: ${fixtureLine(next)}.` : ""}`,
      true,
      ["Football betting odds & live scores", next.length ? `Up next: ${fixtureLine(next.slice(0, 2))}` : "Live odds, in-play scores and booking codes"],
    );
  }
  if (first === "league" && second) {
    const lg = leaguesIn(feed).find((l) => l.slug === second);
    const name = lg ? `${lg.name}${lg.country ? ` (${lg.country})` : ""}` : second.replace(/-/g, " ");
    return base(
      `${lg?.name ?? name} odds & fixtures | ${BRAND}`,
      `${name} betting odds on ${BRAND}.${lg?.matches.length ? ` ${lg.matches.length} upcoming matches, including ${fixtureLine(lg.matches)}.` : " Fixtures, live scores and markets."}`,
      // A league that isn't in the feed right now: keep it out of search until it has matches.
      !feed || !!lg,
      [`${lg?.name ?? name} odds`, lg ? `${lg.country ? `${lg.country} · ` : ""}${lg.matches.length} upcoming matches` : "Fixtures, live scores and markets"],
    );
  }
  if (first === "sports") {
    const Sport = SPORT_NAMES[second ?? "football"] ?? "Football";
    const sport = Sport.toLowerCase();
    const views: Record<string, string> = { today: `Today's ${sport} matches`, live: `Live ${sport}`, all: `All ${sport} matches`, soon: `${Sport} in the next 3 hours` };
    const title = third ? views[third] ?? `${Sport} matches` : `${Sport} betting odds`;
    return base(`${title} | ${BRAND}`, `${title} with the latest odds on ${BRAND}: 1X2, over/under, both teams to score and more.`, !third || third in views,
      [title, "1X2, over/under, both teams to score and more"]);
  }
  const fixed: Record<string, [string, string, boolean]> = {
    login: ["Log in", `Log in to ${BRAND} with your phone number or email.`, true],
    signup: ["Open an account", `Join ${BRAND} in a minute: phone number, a one-time code, and you're in.`, true],
    betslip: ["Bet slip", `Your ${BRAND} bet slip.`, false],
    "my-bets": ["My bets", `Your ${BRAND} bets.`, false],
    account: ["My account", `Your ${BRAND} account.`, false],
    search: ["Search", `Search ${BRAND} for teams, leagues and live games.`, false],
  };
  const f = fixed[first];
  if (f) return base(`${f[0]} | ${BRAND}`, f[1], f[2], [f[0], f[1]]);
  return base(`Page not found | ${BRAND}`, `This page doesn't exist.`, false);
}
