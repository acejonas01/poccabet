import { useState } from "react";
import { useFilter } from "../context/FilterContext";

const VIEW_TABS = [
  { key: "popular", label: "Popular" },
  { key: "today", label: "Today" },
  { key: "boosted", label: "Boosted", icon: "⬆️" },
  { key: "footballgo", label: "FootballGO" },
];

const SPORTS = [
  { key: "football", icon: "⚽", label: "Soccer" },
  { key: "tennis", icon: "🎾", label: "Tennis" },
  { key: "basketball", icon: "🏀", label: "Basketball" },
];

const MARKETS = [
  "1X2",
  "Total Goals",
  "Double Chance",
  "GG/NG",
  "Over/Under",
  "Draw No Bet",
  "Correct Score",
  "HT/FT",
  "First Goalscorer",
  "Handicap",
];

export function MarketFilter() {
  const { selectedSport, setSelectedSport } = useFilter();
  const [view, setView] = useState("popular");
  const [market, setMarket] = useState("1X2");
  const [earlyWins, setEarlyWins] = useState(false);

  return (
    <section className="market-filter">
      <div className="mf-views">
        {VIEW_TABS.map((t) => (
          <button
            key={t.key}
            className={`mf-view ${view === t.key ? "active" : ""}`}
            onClick={() => setView(t.key)}
          >
            {t.icon && <span className="mf-view-icon">{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mf-sports">
        {SPORTS.map((s) => (
          <button
            key={s.key}
            className={`mf-sport ${selectedSport === s.key ? "active" : ""}`}
            onClick={() => setSelectedSport(selectedSport === s.key ? "all" : s.key)}
            aria-label={s.label}
            title={s.label}
          >
            {s.icon}
          </button>
        ))}
      </div>

      <div className="mf-markets">
        {MARKETS.map((m) => (
          <button
            key={m}
            className={`mf-market ${market === m ? "active" : ""}`}
            onClick={() => setMarket(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="mf-toggle">
        <input
          type="checkbox"
          checked={earlyWins}
          onChange={(e) => setEarlyWins(e.target.checked)}
        />
        <span className={`mf-switch ${earlyWins ? "on" : ""}`} aria-hidden="true" />
        <span className="mf-toggle-label">Early Wins</span>
      </label>
    </section>
  );
}
