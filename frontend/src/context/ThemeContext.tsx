import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Enabled themes, in toggle order. Theme B is disabled for now (its CSS is kept).
// Theme C = the "Poccabet Homepage Redesign" design — a full layout, not just colours.
export const THEMES = ["a", "c"];

interface ThemeContextValue {
  theme: string;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function initialTheme() {
  try {
    const saved = localStorage.getItem("theme");
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
      localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const cycleTheme = () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);

  return <ThemeContext.Provider value={{ theme, cycleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
