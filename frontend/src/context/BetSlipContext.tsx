import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface Selection {
  outcomeId: string;
  label: string;
  odds: number;
  marketName: string;
  eventLabel: string;
}

interface BetSlipContextValue {
  selections: Selection[];
  addSelection: (s: Selection) => void;
  removeSelection: (outcomeId: string) => void;
  clear: () => void;
  combinedOdds: number;
}

const BetSlipContext = createContext<BetSlipContextValue | undefined>(undefined);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [selections, setSelections] = useState<Selection[]>([]);

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

  const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1);

  return (
    <BetSlipContext.Provider value={{ selections, addSelection, removeSelection, clear, combinedOdds }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error("useBetSlip must be used within BetSlipProvider");
  return ctx;
}
