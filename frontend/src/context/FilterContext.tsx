import { createContext, useContext, useState, type ReactNode } from "react";

interface FilterState {
  selectedSport: string;
  selectedLeague: string | null;
  liveOnly: boolean;
  setSelectedSport: (sport: string) => void;
  setSelectedLeague: (league: string | null) => void;
  toggleLiveOnly: () => void;
}

const FilterContext = createContext<FilterState>(null!);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedSport, _setSelectedSport] = useState("all");
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [liveOnly, setLiveOnly] = useState(false);

  function setSelectedSport(sport: string) {
    _setSelectedSport(sport);
    setSelectedLeague(null);
  }

  return (
    <FilterContext.Provider
      value={{
        selectedSport,
        selectedLeague,
        liveOnly,
        setSelectedSport,
        setSelectedLeague,
        toggleLiveOnly: () => setLiveOnly((v) => !v),
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  return useContext(FilterContext);
}
