import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { deferDeviceState } from "../lib/browser";
import { THEMES, THEME_COOKIE, themeFontsUrl } from "./themes";
export { LIGHT_THEMES, THEMES, THEME_BADGE, THEME_NAMES } from "./themes";

// Theme list, names and fonts: see themes.ts. With a single theme there is nothing to switch,
// so the theme buttons disappear (see CAN_SWITCH_THEME). The theme button cycles through the
// offered themes except D; Theme D: hold the theme button, the Account sheet, or ?theme=d.
export const CAN_SWITCH_THEME = THEMES.length > 1;
const CYCLE = THEMES.filter((t) => t !== "d");
// New key: letters were reshuffled, so older saved choices would now mean a different theme.
const STORAGE_KEY = "pocca-theme-v3";

interface ThemeContextValue {
  theme: string;
  cycleTheme: () => void;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function initialTheme() {
  // Next.js: the server renders without the browser's saved choice (it passes the cookie's
  // theme as `initial` instead); the saved choice is applied after the first render.
  if (deferDeviceState()) return THEMES[0];
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

export function ThemeProvider({ children, initial }: { children: ReactNode; initial?: string }) {
  const [theme, setTheme] = useState(() => (initial && THEMES.includes(initial) ? initial : initialTheme()));
  // Server-rendered page: a ?theme= in the address wins after the first render.
  useEffect(() => {
    if (!deferDeviceState()) return;
    const fromUrl = new URLSearchParams(window.location.search).get("theme")?.toLowerCase();
    if (fromUrl && THEMES.includes(fromUrl)) setTheme(fromUrl);
    else if (!initial) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && THEMES.includes(saved)) setTheme(saved);
      } catch { /* storage unavailable */ }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const fonts = themeFontsUrl(theme);
    if (fonts && !document.getElementById(`pocca-fonts-${theme}`)) {
      const link = document.createElement("link");
      link.id = `pocca-fonts-${theme}`;
      link.rel = "stylesheet";
      link.href = fonts;
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
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
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
