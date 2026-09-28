import type { MetadataRoute } from "next";
import { getFeed, leaguesIn, matchesIn } from "../lib/feed";
import { SITE } from "../lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const feed = await getFeed();
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: "hourly" | "daily" | "weekly") =>
    ({ url: `${SITE}${path}`, lastModified: now, changeFrequency, priority });
  return [
    page("/", 1, "hourly"),
    page("/sports/football", 0.9, "hourly"),
    ...["today", "live", "all"].map((v) => page(`/sports/football/${v}`, 0.8, "hourly")),
    ...leaguesIn(feed).map((l) => page(`/league/${l.slug}`, 0.8, "hourly")),
    ...matchesIn(feed).map((m) => page(`/match/${m.slug}`, 0.6, "hourly")),
    page("/signup", 0.5, "weekly"),
    page("/responsible-gambling", 0.4, "weekly"),
    page("/login", 0.3, "weekly"),
  ];
}
