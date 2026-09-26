// Root layout: fonts, icons, the shared styles and the app. Every URL is rendered on the server
// with its matches, so search engines read real content; the browser then takes over.
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../../frontend/src/index.css";
import { cookies } from "next/headers";
import { THEMES, THEME_COOKIE, themeFontsUrl } from "../../frontend/src/context/themes";
import { getFeed } from "../lib/feed";
import { SITE } from "../lib/seo";
import { SiteApp } from "./SiteApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  applicationName: "Poccabet",
  icons: {
    icon: [{ url: "/icons/app/icon.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  // Google Search Console: set GOOGLE_SITE_VERIFICATION on Vercel to the code it gives you.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#131E24" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const feed = await getFeed();
  // The visitor's theme (saved in a cookie by the theme button), so the page arrives in it.
  const saved = (await cookies()).get(THEME_COOKIE)?.value ?? "";
  const theme = THEMES.includes(saved) ? saved : THEMES[0];
  const themeFonts = themeFontsUrl(theme);
  return (
    <html lang="en" data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {themeFonts && <link id={`pocca-fonts-${theme}`} rel="stylesheet" href={themeFonts} />}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;1,700&family=Manrope:wght@400;600;700;800&display=swap" />
      </head>
      <body>
        <SiteApp feed={feed} theme={theme} />
        {children}
      </body>
    </html>
  );
}
