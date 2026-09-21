import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useFilter } from "../context/FilterContext";
import { useAuth } from "../context/AuthContext";

const ALL_SPORTS = [
  { name: "Soccer", icon: "⚽", slug: "football", demo: 1426 },
  { name: "Tennis", icon: "🎾", slug: "tennis", demo: 2424 },
  { name: "Basketball", icon: "🏀", slug: "basketball", demo: 319 },
  { name: "American Football", icon: "🏈", slug: "american-football", demo: 33 },
  { name: "Aussie Rules", icon: "🏉", slug: "aussie-rules", demo: 9 },
  { name: "Badminton", icon: "🏸", slug: "badminton", demo: 77 },
  { name: "Baseball", icon: "⚾", slug: "baseball", demo: 7 },
  { name: "Boxing", icon: "🥊", slug: "boxing", demo: 32 },
  { name: "Cricket", icon: "🏏", slug: "cricket", demo: 12 },
  { name: "Floorball", icon: "🏑", slug: "floorball", demo: 2 },
  { name: "Futsal", icon: "⚽", slug: "futsal", demo: 5 },
  { name: "Handball", icon: "🤾", slug: "handball", demo: 61 },
  { name: "Ice Hockey", icon: "🏒", slug: "ice-hockey", demo: 257 },
  { name: "MMA", icon: "🥋", slug: "mma", demo: 28 },
  { name: "Rugby", icon: "🏉", slug: "rugby", demo: 40 },
  { name: "Snooker", icon: "🎱", slug: "snooker", demo: 11 },
  { name: "Squash", icon: "🎾", slug: "squash", demo: 1 },
  { name: "Table Tennis", icon: "🏓", slug: "table-tennis", demo: 1001 },
  { name: "Volleyball", icon: "🏐", slug: "volleyball", demo: 24 },
];

interface LeagueData {
  name: string;
  count: number;
}

interface SportData {
  slug: string;
  count: number;
  leagues: LeagueData[];
}

export function LeftSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const { selectedSport, selectedLeague, liveOnly, setSelectedSport, setSelectedLeague, toggleLiveOnly } =
    useFilter();
  const { isAuthenticated, user, balance, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    api.getEvents().then((res) => setEvents(res.events)).catch(() => {});
  }, []);


  const sportData = useMemo(() => {
    const map = new Map<string, SportData>();
    for (const e of events) {
      const existing = map.get(e.sport.slug);
      if (existing) {
        const league = existing.leagues.find((l) => l.name === e.league);
        if (league) league.count++;
        else existing.leagues.push({ name: e.league, count: 1 });
        existing.count++;
      } else {
        map.set(e.sport.slug, {
          slug: e.sport.slug,
          count: 1,
          leagues: [{ name: e.league, count: 1 }],
        });
      }
    }
    return map;
  }, [events]);

  const displaySports = useMemo(() => {
    return ALL_SPORTS.map((sport) => {
      const real = sportData.get(sport.slug);
      return {
        ...sport,
        count: real?.count ?? sport.demo,
        hasData: !!real,
        leagues: real?.leagues ?? [],
      };
    }).filter(
      (sport) => !search.trim() || sport.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [sportData, search]);

  function handleSportClick(slug: string) {
    setSelectedSport(slug);
    setExpandedSport((prev) => (prev === slug ? null : slug));
  }

  function handleLeagueClick(sportSlug: string, leagueName: string) {
    setSelectedSport(sportSlug);
    setSelectedLeague(leagueName);
    onClose();
  }

  const stickyControls = (
    <div className="sidebar-sticky-top">
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Search for teams, live events"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      <button
        className={`live-betting-btn ${liveOnly ? "active" : ""}`}
        onClick={() => {
          toggleLiveOnly();
          onClose();
        }}
      >
        LIVE BETTING
        <svg className="live-count" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      <div className="time-filters">
        {["all", "24h", "48h", "7d"].map((tf) => (
          <button
            key={tf}
            className={`time-pill ${timeFilter === tf ? "active" : ""}`}
            onClick={() => setTimeFilter(tf)}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );

  const sportsContent = (
    <>
      {displaySports.map((sport) => (
        <div key={sport.slug} className="sidebar-sport-group">
          <button
            className={`sidebar-item ${selectedSport === sport.slug ? "active" : ""}`}
            onClick={() => handleSportClick(sport.slug)}
          >
            <span className="sport-icon">{sport.icon}</span>
            <span className="sidebar-item-label">{sport.name}</span>
            <span className="sidebar-count">({sport.count})</span>
            <svg
              className={`chevron ${expandedSport === sport.slug ? "expanded" : ""}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {expandedSport === sport.slug && sport.leagues.length > 0 && (
            <div className="sidebar-leagues">
              {sport.leagues.map((league) => (
                <button
                  key={league.name}
                  className={`sidebar-item league-item ${selectedLeague === league.name ? "active" : ""}`}
                  onClick={() => handleLeagueClick(sport.slug, league.name)}
                >
                  <span className="sidebar-item-label">{league.name}</span>
                  <span className="sidebar-count">({league.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {displaySports.length === 0 && search.trim() && (
        <p className="sidebar-no-results">No matches found</p>
      )}
    </>
  );

  return (
    <>
      <aside className="left-sidebar">
        {stickyControls}
        <div className="sidebar-sports-list">
          {sportsContent}
        </div>
      </aside>

      {open && (
        <div className="sidebar-overlay" onClick={onClose}>
          <div className="sidebar-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-drawer-header">
              <span className="brand">
                Pocca<span>bet</span>
              </span>
              <button className="sidebar-close-btn" onClick={onClose}>
                {"×"}
              </button>
            </div>

            <div className="sidebar-mobile-nav">
              {isAuthenticated && (
                <div className="sidebar-user-info">
                  <span className="balance-pill">{"₦"}{balance.toFixed(2)}</span>
                  <span className="user-name">{user?.displayName}</span>
                </div>
              )}
              <Link
                to="/"
                className={`sidebar-nav-link ${location.pathname === "/" ? "active" : ""}`}
                onClick={onClose}
              >
                Home
              </Link>
              {isAuthenticated && (
                <Link
                  to="/my-bets"
                  className={`sidebar-nav-link ${location.pathname === "/my-bets" ? "active" : ""}`}
                  onClick={onClose}
                >
                  My Bets
                </Link>
              )}
              {isAuthenticated ? (
                <button className="sidebar-nav-link" onClick={() => { logout(); onClose(); }}>
                  Log out
                </button>
              ) : (
                <>
                  <Link to="/login" className="sidebar-nav-link" onClick={onClose}>Log in</Link>
                  <Link to="/signup" className="sidebar-nav-link cta" onClick={onClose}>Sign up</Link>
                </>
              )}
            </div>

            {sportsContent}
          </div>
        </div>
      )}
    </>
  );
}
