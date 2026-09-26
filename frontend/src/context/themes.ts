// Theme ids, names and fonts. Plain data (no React), so the Next.js server can read it too.
//   A (default) — redesign, deepest charcoal (#131E24), sunken league headers
//   B           — redesign, deep charcoal (#222C32)
//   C           — redesign, lighter/softer charcoal
//   D           — the original layout, kept out of the everyday toggle
//   Bento Pop, Matchday Poster, Daylight — light themes with their own phone layout
//     (ids "bento", "poster", "daylight"), offered on the Next.js site only.
//
// Build switch: VITE_THEMES lists the themes a deployment offers (the Next.js site sets
// "a,bento,poster,daylight"). Unset = A, B, C and D (the Vite site).
export const KNOWN_THEMES = ["a", "b", "c", "d", "bento", "poster", "daylight"];
const DEFAULT_THEMES = ["a", "b", "c", "d"];
const ENABLED = String(import.meta.env.VITE_THEMES ?? "")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter((t) => KNOWN_THEMES.includes(t));
export const THEMES = ENABLED.length ? ENABLED : DEFAULT_THEMES;

export const THEME_NAMES: Record<string, string> = {
  a: "Theme A", b: "Theme B", c: "Theme C", d: "Theme D",
  bento: "Theme Bento Pop", poster: "Theme Matchday Poster", daylight: "Theme Daylight",
};
// Short label on the theme button's badge.
export const THEME_BADGE: Record<string, string> = { a: "A", b: "B", c: "C", d: "D", bento: "BP", poster: "MP", daylight: "DL" };
// Themes with a light page (and their own phone layout).
export const LIGHT_THEMES = ["bento", "poster", "daylight"];
// Google Fonts a theme needs beyond the site's defaults (css2 query), loaded only for that theme.
export const THEME_FONTS: Record<string, string> = {
  bento: "family=Unbounded:wght@600;700;800&family=DM+Sans:wght@500;600;700;800",
  poster: "family=Anton&family=Archivo:wght@500;600;700;800;900",
  daylight: "family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800",
};
export const themeFontsUrl = (theme: string) =>
  THEME_FONTS[theme] ? `https://fonts.googleapis.com/css2?${THEME_FONTS[theme]}&display=swap` : null;

// The chosen theme is also kept in this cookie, so the Next.js server renders it straight away.
export const THEME_COOKIE = "pocca-theme";
