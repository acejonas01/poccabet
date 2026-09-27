// The betting site: every URL is rendered on the server with its matches, so search engines read
// real content; the browser then takes over. The app lives here, so it stays mounted while
// moving between pages.
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { getFeed } from "../../lib/feed";
import { SiteApp } from "./SiteApp";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [feed, h] = await Promise.all([getFeed(), headers()]);
  // Desktop or phone layout for the server's page: Chrome/Edge say so directly (Sec-CH-UA-Mobile),
  // others from the user agent. Crawlers with a phone user agent get the phone page.
  const hint = h.get("sec-ch-ua-mobile");
  const desk = hint ? hint === "?0" : !/Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(h.get("user-agent") ?? "");
  return (
    <>
      <SiteApp feed={feed} desk={desk} />
      {children}
    </>
  );
}
