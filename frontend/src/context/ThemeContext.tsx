import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Themes:
//   A (default) — redesign, deepest charcoal (#131E24), sunken league headers
//   B           — redesign, deep charcoal (#222C32)
//   C           — redesign, lighter/softer charcoal
//   D           — the original layout, kept out of the everyday toggle
// The theme button cycles A -> B -> C. Theme D: hold the theme button, the Account sheet,
// or ?theme=d in the address. From Theme D the button returns to A.
//
// Build switch: VITE_THEMES lists the themes a deployment offers (e.g. "a" for a Theme-A-only
// site). Unset = all four. With a single theme there is nothing to switch, so the theme
// buttons disappear (see CAN_SWITCH_THEME).
const ALL_THEMES = ["a", "b", "c", "d"];
const ENABLED = String(import.meta.env.VITE_THEMES ?? "")
  .split(",")
  .map((t) => t.trim().toLowerCase())
  .filter((t) => ALL_THEMES.includes(t));
export const THEMES = ENABLED.length ? ENABLED : ALL_THEMES;
export const CAN_SWITCH_THEME = THEMES.length > 1;
const CYCLE = ["a", "b", "c"].filter((t) => THEMES.includes(t));
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
