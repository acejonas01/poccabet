import type { MetadataRoute } from "next";
import { SITE } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/my-bets", "/betslip", "/search", "/office", "/api/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
