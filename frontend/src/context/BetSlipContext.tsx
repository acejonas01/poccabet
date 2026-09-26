import { createContext, useContext, useCallback, useEffect, type ReactNode } from "react";
import { useDeviceState } from "../lib/browser";

export interface Selection {
  outcomeId: string; // redesign: "<matchId>|<market>|<selection>"; Theme D: a database outcome id
  label: string;
  odds: number;
  marketName: string;
  eventLabel: string;
  unavailable?: boolean; // the server said it can't be bet any more (match started, market suspended…)
}

interface BetSlipContextValue {
  selections: Selection[];
  addSelection: (s: Selection) => void;
  removeSelection: (outcomeId: string) => void;
  clear: () => void;
  combinedOdds: number;
  // After the server answers: new prices, and selections that can't be bet any more.
  updateSelections: (changes: Record<string, { odds?: number; unavailable?: boolean }>) => void;
  replaceAll: (next: Selection[]) => void;
}

const BetSlipContext = createContext<BetSlipContextValue | undefined>(undefined);

// The slip is kept on the device so a reload (or coming back later) doesn't lose it: for
// 24 hours after the last change. Prices are refreshed from the feed once the site loads.
const STORE_KEY = "pocca-slip-v1";
const KEEP_FOR = 24 * 3600 * 1000;

function savedSelections(): Selection[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null");
    if (saved && Date.now() - saved.at < KEEP_FOR && Array.isArray(saved.selections)) return saved.selections;
  } catch {
    // unreadable or blocked storage: start empty
  }
  return [];
}

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useDeviceState<Selection[]>(savedSelections, []);

  useEffect(() => {
    try {
      if (selections.length) localStorage.setItem(STORE_KEY, JSON.stringify({ at: Date.now(), selections }));
      else localStorage.removeItem(STORE_KEY);
    } catch {
      // storage full or blocked: the slip still works, it just won't survive a reload
    }
  }, [selections]);

  const addSelection = useCallback((s: Selection) => {
    setSelections((prev) => {
      const withoutSameMarket = prev.filter((p) => p.outcomeId !== s.outcomeId);
      const alreadyHas = prev.some((p) => p.outcomeId === s.outcomeId);
      if (alreadyHas) return withoutSameMarket;
      return [...prev, s];
    });
  }, []);

  const removeSelection = useCallback((outcomeId: string) => {
    setSelections((prev) => prev.filter((s) => s.outcomeId !== outcomeId));
  }, []);

  const clear = useCallback(() => setSelections([]), []);

  const updateSelections = useCallback((changes: Record<string, { odds?: number; unavailable?: boolean }>) => {
    setSelections((prev) => prev.map((s) => (changes[s.outcomeId] ? { ...s, ...changes[s.outcomeId] } : s)));
  }, []);

  const replaceAll = useCallback((next: Selection[]) => setSelections(next), []);

  const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1);

  return (
    <BetSlipContext.Provider value={{ selections, addSelection, removeSelection, clear, combinedOdds, updateSelections, replaceAll }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}
