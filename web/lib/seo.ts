// Titles and descriptions for each page (what search results and link previews show).
import type { Metadata } from "next";
import type { InitialFeed } from "../../frontend/src/redesign/data";
import { leaguesIn } from "./feed";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://poccabet.vercel.app").replace(/\/$/, "");
const BRAND = "Poccabet";

const fixtureLine = (m: { home: string; away: string }[]) =>
  m.slice(0, 3).map((x) => `${x.home} vs ${x.away}`).join(", ");

export function metadataFor(path: string[], feed: InitialFeed | null): Metadata {
  const url = `${SITE}/${path.join("/")}`.replace(/\/$/, "") || SITE;
  const base = (title: string, description: string, index = true): Metadata => ({
    title,
    description,
    alternates: { canonical: url },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, siteName: BRAND, type: "website", images: [{ url: `${SITE}/icons/app/icon-512.png`, width: 512, height: 512 }] },
    twitter: { card: "summary", title, description },
  });
  const [first, second, third] = path;

  if (!first) {
    const next = feed?.upcoming?.slice(0, 3).map((e: any) => ({ home: e.homeTeam, away: e.awayTeam })) ?? [];
    return base(
      `${BRAND} — Football betting odds, live scores & more`,
      `Bet on today's football with ${BRAND}: live odds, in-play scores, accumulators and booking codes.${next.length ? ` Up next: ${fixtureLine(next)}.` : ""}`,
    );
  }
  if (first === "league" && second) {
    const lg = leaguesIn(feed).find((l) => l.slug === second);
    const name = lg ? `${lg.name}${lg.country ? ` (${lg.country})` : ""}` : second.replace(/-/g, " ");
    return base(
      `${lg?.name ?? name} odds & fixtures | ${BRAND}`,
      `${name} betting odds on ${BRAND}.${lg?.matches.length ? ` ${lg.matches.length} upcoming matches, including ${fixtureLine(lg.matches)}.` : " Fixtures, live scores and markets."}`,
    );
  }
  if (first === "sports") {
    const sport = (second ?? "football").replace(/-/g, " ");
    const Sport = sport.charAt(0).toUpperCase() + sport.slice(1);
    const views: Record<string, string> = { today: `Today's ${sport} matches`, live: `Live ${sport}`, all: `All ${sport} matches`, soon: `${Sport} in the next 3 hours` };
    const title = third ? views[third] ?? `${Sport} matches` : `${Sport} betting odds`;
    return base(`${title} | ${BRAND}`, `${title} with the latest odds on ${BRAND}: 1X2, over/under, both teams to score and more.`, !third || third in views);
  }
  const fixed: Record<string, [string, string, boolean]> = {
    login: ["Log in", `Log in to ${BRAND} with your phone number or email.`, true],
    signup: ["Open an account", `Join ${BRAND} in a minute: phone number, a one-time code, and you're in.`, true],
    betslip: ["Bet slip", `Your ${BRAND} bet slip.`, false],
    "my-bets": ["My bets", `Your ${BRAND} bets.`, false],
    account: ["My account", `Your ${BRAND} account.`, false],
  };
  const f = fixed[first];
  if (f) return base(`${f[0]} | ${BRAND}`, f[1], f[2]);
  return base(`Page not found | ${BRAND}`, `This page doesn't exist.`, false);
}
