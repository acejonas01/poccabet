// Every URL: the app itself is in the layout; this sets the page's title/description and adds
// structured data for search engines.
import type { Metadata } from "next";
import { getFeed, leaguesIn } from "../../lib/feed";
import { SITE, metadataFor } from "../../lib/seo";

type Props = { params: Promise<{ path?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path = [] } = await params;
  return metadataFor(path, await getFeed());
}

export default async function Page({ params }: Props) {
  const { path = [] } = await params;
  const feed = await getFeed();
  const matches = path[0] === "league"
    ? leaguesIn(feed).find((l) => l.slug === path[1])?.matches ?? []
    : path.length === 0 ? (feed?.upcoming ?? []).slice(0, 20).map((e: any) => ({ home: e.homeTeam, away: e.awayTeam, start: e.startTime })) : [];
  const data = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Poccabet", url: SITE },
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
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
