import { useFilter } from "../context/FilterContext";

const ICONS: Record<string, string> = {
  all: "🏆",
  football: "⚽",
  basketball: "🏀",
  tennis: "🎾",
};

export interface SportOption {
  slug: string;
  name: string;
  count: number;
}

export function SportTabs({ sports, liveCount }: { sports: SportOption[]; liveCount: number }) {
  const { selectedSport, liveOnly, setSelectedSport, toggleLiveOnly } = useFilter();

  return (
    <div className="sport-tabs">
      <div className="sport-tabs-scroll">
        <button
          className={`sport-pill ${selectedSport === "all" ? "active" : ""}`}
          onClick={() => setSelectedSport("all")}
        >
          <span>{ICONS.all}</span> All
        </button>
        {sports.map((s) => (
          <button
            key={s.slug}
            className={`sport-pill ${selectedSport === s.slug ? "active" : ""}`}
            onClick={() => setSelectedSport(s.slug)}
          >
            <span>{ICONS[s.slug] ?? "🏅"}</span> {s.name}
            <em>{s.count}</em>
          </button>
        ))}
      </div>
      <button className={`live-toggle ${liveOnly ? "active" : ""}`} onClick={toggleLiveOnly}>
        <span className="live-dot" /> Live ({liveCount})
      </button>
    </div>
  );
}
