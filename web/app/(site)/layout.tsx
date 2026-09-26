// The betting site: every URL is rendered on the server with its matches, so search engines read
// real content; the browser then takes over. The app lives here, so it stays mounted while
// moving between pages.
import type { ReactNode } from "react";
import { getFeed } from "../../lib/feed";
import { SiteApp } from "./SiteApp";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const feed = await getFeed();
  return (
    <>
      <SiteApp feed={feed} />
      {children}
    </>
  );
}
