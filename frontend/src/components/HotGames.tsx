import { useState } from "react";

const TABS = [
  { key: "trending", icon: "🔥", label: "Trending Bets" },
  { key: "hot", icon: "🚀", label: "Hot Games" },
  { key: "boosts", icon: "⬆️", label: "Boosts" },
];

const GAMES = [
  { name: "Aviator", tag: "₦1,000,000 FREE BET", img: "/games/aviator.jpg" },
  { name: "Gigahot 40", tag: "", img: "/games/gigahot-40.jpg" },
  { name: "Mines", tag: "Poccabet Originals", img: "/games/mines.jpg" },
  { name: "Multi Hot 5", tag: "", img: "/games/multi-hot-5.jpg" },
  { name: "Poccabet Spin", tag: "EXCLUSIVE", img: "/games/poccabet-spin.jpg" },
];

export function HotGames() {
  const [tab, setTab] = useState("hot");

  return (
    <section className="hot-games">
      <div className="hg-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`hg-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <span className="hg-tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="hg-grid">
        {GAMES.map((g) => (
          <a key={g.name} href="#" className="game-tile">
            <img src={g.img} alt="" className="game-art" />
            <span className="game-meta">
              <span className="game-name">{g.name}</span>
              {g.tag && <span className="game-tag">{g.tag}</span>}
            </span>
          </a>
        ))}
      </div>

      <a href="#" className="more-games">
        More Games <span aria-hidden="true">{"›"}</span>
      </a>
    </section>
  );
}
