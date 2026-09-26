import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Themes:
//   A (default) — redesign, deepest charcoal (#131E24), sunken league headers
//   B           — redesign, deep charcoal (#222C32)
//   C           — redesign, lighter/softer charcoal
//   D           — the original layout, kept out of the everyday toggle
//   Bento Pop, Matchday Poster, Daylight — light themes with their own phone layout
//     (ids "bento", "poster", "daylight"; ?theme=bento etc. in the address)
// The theme button cycles A -> B -> C -> Bento Pop -> Matchday Poster -> Daylight. Theme D: hold
// the theme button, the Account sheet, or ?theme=d in the address. From Theme D the button returns to A.
//
// Build switch: VITE_THEMES lists the themes a deployment offers (e.g. "a" for a Theme-A-only
// site). Unset = all. With a single theme there is nothing to switch, so the theme
// buttons disappear (see CAN_SWITCH_THEME).
const ALL_THEMES = ["a", "b", "c", "d", "bento", "poster", "daylight"];
export const THEME_NAMES: Record<string, string> = {
  a: "Theme A", b: "Theme B", c: "Theme C", d: "Theme D",
  bento: "Theme Bento Pop", poster: "Theme Matchday Poster", daylight: "Theme Daylight",
};
// Short label on the theme button's badge.
export const THEME_BADGE: Record<string, string> = { a: "A", b: "B", c: "C", d: "D", bento: "BP", poster: "MP", daylight: "DL" };
// Themes with a light page (their own phone layout too).
export const LIGHT_THEMES = ["bento", "poster", "daylight"];
// Fonts a theme needs beyond the site's defaults, loaded only when the theme is picked.
const THEME_FONTS: Record<string, string> = {
  bento: "family=Unbounded:wght@600;700;800&family=DM+Sans:wght@500;600;700;800",
  poster: "family=Anton&family=Archivo:wght@500;600;700;800;900",
  daylight: "family=Sora:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800",
};
const ENABLED = String(import.meta.env.VITE_THEMES ?? "")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter((t) => ALL_THEMES.includes(t));
export const THEMES = ENABLED.length ? ENABLED : ALL_THEMES;
export const CAN_SWITCH_THEME = THEMES.length > 1;
const CYCLE = ["a", "b", "c", "bento", "poster", "daylight"].filter((t) => THEMES.includes(t));
// New key: letters were reshuffled, so older saved choices would now mean a different theme.
const STORAGE_KEY = "pocca-theme-v3";

interface ThemeContextValue {
  theme: string;
  cycleTheme: () => void;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function initialTheme() {
  if (typeof window === "undefined") return THEMES[0]; // server render (Next.js site)
  const fromUrl = new URLSearchParams(window.location.search).get("theme")?.toLowerCase();
  if (fromUrl && THEMES.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.includes(saved)) return saved;
  } catch {
    // storage unavailable — fall through to the default
  }
  return THEMES[0];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const fonts = THEME_FONTS[theme];
    if (fonts && !document.getElementById(`pocca-fonts-${theme}`)) {
      const link = document.createElement("link");
      link.id = `pocca-fonts-${theme}`;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?${fonts}&display=swap`;
      document.head.appendChild(link);
    }
    // The phone's browser bar takes the header colour.
    const header = getComputedStyle(document.documentElement).getPropertyValue("--tc-header").trim();
    if (header) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", header);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const cycleTheme = () => CYCLE.length && setTheme((t) => CYCLE[(CYCLE.indexOf(t) + 1) % CYCLE.length]);
  const choose = (t: string) => THEMES.includes(t) && setTheme(t);

  return <ThemeContext.Provider value={{ theme, cycleTheme, setTheme: choose }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
