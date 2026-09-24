import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Themes:
//   A (default) — the redesign layout, deep charcoal
//   B           — the redesign layout, lighter/softer charcoal
//   C           — the original layout, kept out of the everyday toggle
// The theme button only cycles A <-> B. Theme C: hold the theme button, the Account
// sheet, or ?theme=c in the address. From Theme C the button returns to A.
export const THEMES = ["a", "b", "c"];
const CYCLE = ["a", "b"];
// New key: old saves used "c" for the redesign, which is now the original layout.
const STORAGE_KEY = "pocca-theme";

interface ThemeContextValue {
  theme: string;
  cycleTheme: () => void;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function initialTheme() {
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

  const cycleTheme = () => setTheme((t) => CYCLE[(CYCLE.indexOf(t) + 1) % CYCLE.length]);
  const choose = (t: string) => THEMES.includes(t) && setTheme(t);

  return <ThemeContext.Provider value={{ theme, cycleTheme, setTheme: choose }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
