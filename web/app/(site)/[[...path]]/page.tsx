// Every URL: the app itself is in the layout; this sets the page's title/description, returns
// 404s and redirects for unknown URLs, and adds structured data for search engines.
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getFeed, leaguesIn } from "../../../lib/feed";
import { SPORT_NAMES, checkPath } from "../../../lib/routes";
import { SITE, metadataFor } from "../../../lib/seo";

type Props = { params: Promise<{ path?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  const route = checkPath(path);
  if ("notFound" in route) return { title: "Page not found | Poccabet", robots: { index: false, follow: true } };
  if ("redirect" in route) return {};
  return metadataFor(path, await getFeed());
}

// Seen by search engines and screen readers; the home screen has no visible page title.
const hidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

export default async function Page({ params }: Props) {
  const { path = [] } = await params;
  const route = checkPath(path);
  if ("redirect" in route) permanentRedirect(route.redirect);
  if ("notFound" in route) notFound();

  const feed = await getFeed();
  const league = path[0] === "league" ? leaguesIn(feed).find((l) => l.slug === path[1]) : undefined;
  const matches = league?.matches
    ?? (path.length === 0 ? (feed?.upcoming ?? []).slice(0, 20).map((e: any) => ({ home: e.homeTeam, away: e.awayTeam, start: e.startTime })) : []);

  // Home › League, or Home › Football › Today
  const crumbs: [string, string][] = [];
  if (league) crumbs.push([league.name, `/league/${league.slug}`]);
  if (path[0] === "sports" && path[1]) {
    crumbs.push([SPORT_NAMES[path[1]], `/sports/${path[1]}`]);
    const views: Record<string, string> = { today: "Today", live: "Live", all: "All matches", soon: "Next 3 hours" };
    if (path[2] && views[path[2]]) crumbs.push([views[path[2]], `/sports/${path[1]}/${path[2]}`]);
  }

  const data = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Poccabet", url: SITE },
    { "@context": "https://schema.org", "@type": "Organization", name: "Poccabet", url: SITE, logo: `${SITE}/icons/app/icon-512.png` },
    ...(crumbs.length ? [{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [["Home", "/"] as [string, string], ...crumbs].map(([name, href], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}${href}` })),
    }] : []),
    ...(matches.length ? [{
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: matches.slice(0, 20).map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "SportsEvent", name: `${m.home} vs ${m.away}`, startDate: m.start, sport: "Soccer",
          homeTeam: { "@type": "SportsTeam", name: m.home }, awayTeam: { "@type": "SportsTeam", name: m.away } },
      })),
    }] : []),
  ];
  return (
    <>
      {path.length === 0 && <h1 style={hidden}>Poccabet: football betting odds, live scores and booking codes</h1>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
    </>
  );
}
