import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { HotGames } from "../components/HotGames";
import { MarketFilter } from "../components/MarketFilter";
import { ALL_COLUMNS, getEventCode, getOdds } from "../lib/odds";
import { useBetSlip } from "../context/BetSlipContext";
import { useFilter } from "../context/FilterContext";

const PROMO_SLIDES = [
  "/slides/Slide-1.jpg",
  "/slides/Slide-2.jpg",
  "/slides/Slide-3.jpg",
  "/slides/Slide-4.jpg",
  "/slides/Slide-5.jpg",
];




// TEMPORARY — set to false (or delete this and the effect below) to stop the demo odds drift.
const DEMO_ODDS_MOVEMENT = true;

// Grouping key for the live board section.
export const LIVE_BOARD_KEY = "__liveboard";
const LIVE_BOARD_PER_PAGE = 5;
const LIVE_BOARD_SIZE = 15;

// The live board: the featured section at the top of the page.
// TEMPORARY — picks its fixtures from the first 5 football events.
function applyLiveBoard(list: any[]) {
  if (!DEMO_ODDS_MOVEMENT || list.length === 0) return list;
  const featured = new Set(
    list.filter((e) => e.sport.slug === "football").slice(0, LIVE_BOARD_SIZE).map((e) => e.id)
  );
  return list.map((e) =>
    featured.has(e.id) ? { ...e, league: LIVE_BOARD_KEY, status: "SCHEDULED" } : e
  );
}



export function OddsBoard() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("all");
  const [activeSlide, setActiveSlide] = useState(0);
  const [movements, setMovements] = useState<Record<string, "up" | "down">>({});
  const [livePage, setLivePage] = useState(1);
  const prevOdds = useRef<Record<string, number>>({});
  const slideInterval = useRef<ReturnType<typeof setInterval>>(null);
  const { selectedSport, selectedLeague, liveOnly, setSelectedSport } = useFilter();
  const { selections, addSelection } = useBetSlip();

  const resetAutoplay = useCallback(() => {
    if (slideInterval.current) clearInterval(slideInterval.current);
    slideInterval.current = setInterval(() => {
      setActiveSlide((s) => (s + 1) % PROMO_SLIDES.length);
    }, 7000);
  }, []);

  useEffect(() => {
    resetAutoplay();
    return () => { if (slideInterval.current) clearInterval(slideInterval.current); };
  }, [resetAutoplay]);

  function goToSlide(i: number) {
    setActiveSlide(i);
    resetAutoplay();
  }

  useEffect(() => {
    api
      .getEvents()
      .then((res) => setEvents(applyLiveBoard(res.events)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (DEMO_ODDS_MOVEMENT) return;
    const id = setInterval(() => {
      api.getEvents().then((res) => setEvents(res.events)).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // TEMPORARY — drives the odds-movement animation while there is no live price feed.
  useEffect(() => {
    if (!DEMO_ODDS_MOVEMENT) return;
    const id = setInterval(() => {
      setEvents((prev) =>
        prev.map((e) => ({
          ...e,
          markets: e.markets.map((m: any) => ({
            ...m,
            outcomes: m.outcomes.map((o: any) =>
              Math.random() < 0.35
                ? {
                    ...o,
                    odds: +Math.max(1.05, o.odds + (Math.random() < 0.5 ? 0.15 : -0.15)).toFixed(2),
                  }
                : o
            ),
          })),
        }))
      );
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const current: Record<string, number> = {};
    const moved: Record<string, "up" | "down"> = {};

    for (const e of events) {
      for (const m of e.markets) {
        for (const o of m.outcomes) {
          current[o.id] = o.odds;
          const before = prevOdds.current[o.id];
          if (before !== undefined && before !== o.odds) {
            moved[o.id] = o.odds > before ? "up" : "down";
          }
        }
      }
    }
    prevOdds.current = current;

    if (Object.keys(moved).length === 0) return;
    setMovements(moved);
    const t = setTimeout(() => setMovements({}), 1800);
    return () => clearTimeout(t);
  }, [events]);

  const sports = useMemo(() => {
    const map = new Map<string, { slug: string; name: string; count: number }>();
    for (const e of events) {
      const existing = map.get(e.sport.slug);
      if (existing) existing.count++;
      else map.set(e.sport.slug, { slug: e.sport.slug, name: e.sport.name, count: 1 });
    }
    return Array.from(map.values());
  }, [events]);

  const filtered = events.filter((e) => {
    if (selectedSport !== "all" && e.sport.slug !== selectedSport) return false;
    if (selectedLeague && e.league !== selectedLeague) return false;
    if (liveOnly && e.status !== "LIVE") return false;
    if (selectedDate !== "all") {
      const eventDate = new Date(e.startTime).toISOString().split("T")[0];
      if (eventDate !== selectedDate) return false;
    }
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of filtered) {
      const list = map.get(e.league) ?? [];
      list.push(e);
      map.set(e.league, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const isSelected = (id: string) => selections.some((s) => s.outcomeId === id);


  function handleOddsClick(outcome: any, marketType: string, event: any) {
    if (!outcome) return;
    const market =
      marketType === "ou"
        ? event.markets.find((m: any) => m.type === "OVER_UNDER")
        : event.markets.find(
            (m: any) => m.type === "MATCH_WINNER" || m.type === "HEAD_TO_HEAD"
          );
    addSelection({
      outcomeId: outcome.id,
      label: outcome.label,
      odds: outcome.odds,
      marketName: market?.name ?? (marketType === "ou" ? "Over/Under" : "Match Winner"),
      eventLabel: `${event.homeTeam} vs ${event.awayTeam}`,
    });
  }

  const dateTabs = useMemo(() => {
    const tabs: { label: string; value: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateNum = `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      tabs.push({
        label: i === 0 ? "Today" : `${dayName} ${dateNum}`,
        value: d.toISOString().split("T")[0],
      });
    }
    tabs.push({ label: "All", value: "all" });
    return tabs;
  }, []);

  const sportCount = new Set(events.map((e) => e.sport.slug)).size || 21;
  const marketCount = events.reduce((acc, e) => acc + e.markets.length, 0) || 577;
  const oddsCount =
    events.reduce(
      (acc, e) =>
        acc + e.markets.reduce((a: number, m: any) => a + m.outcomes.length, 0),
      0
    ) || 1094612;

  return (
    <div className="odds-page">
      <div className="stats-bar">
        <span>
          <strong>{sportCount}</strong> Sports
        </span>
        <span>
          <strong>{events.length || 577}</strong> Events
        </span>
        <span>
          <strong>{marketCount}</strong> Matches
        </span>
        <span>
          <strong>{oddsCount}</strong> Odds
        </span>
      </div>

      <div className="promo-section">
      <div className="promo-carousel">
        <div
          className="promo-track"
          style={{ transform: `translateX(calc(-${activeSlide} * var(--slide-w) + var(--slide-offset)))` }}
        >
          {PROMO_SLIDES.map((src, i) => (
            <div key={i} className="promo-slide">
              <img src={src} alt={`Promo ${i + 1}`} />
            </div>
          ))}
        </div>
        <button
          className="promo-arrow promo-arrow-left"
          onClick={() => goToSlide((activeSlide - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length)}
          aria-label="Previous slide"
        >
          {"❮"}
        </button>
        <button
          className="promo-arrow promo-arrow-right"
          onClick={() => goToSlide((activeSlide + 1) % PROMO_SLIDES.length)}
          aria-label="Next slide"
        >
          {"❯"}
        </button>
      </div>

      <div className="promo-dots">
        {PROMO_SLIDES.map((_, i) => (
          <button
            key={i}
            className={`promo-dot ${activeSlide === i ? "active" : ""}`}
            onClick={() => goToSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
          >
            {"⚽"}
          </button>
        ))}
      </div>
      </div>

      <div className="section-block">
        <div className="section-title-row">
          <h2 className="section-title">Most Popular Bets</h2>
          <div className="date-tabs">
            {dateTabs.map((tab) => (
              <button
                key={tab.value}
                className={`date-tab ${selectedDate === tab.value ? "active" : ""}`}
                onClick={() => setSelectedDate(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="category-tabs">
          <button className="cat-tab">Favourites</button>
          <button className="cat-tab">Virtuals</button>
          <button
            className={`cat-tab ${selectedSport === "all" && !liveOnly ? "active" : ""}`}
            onClick={() => setSelectedSport("all")}
          >
            Top Events
          </button>
          <button className="cat-tab">PoccaTV</button>
          {sports.map((s) => (
            <button
              key={s.slug}
              className={`cat-tab ${selectedSport === s.slug ? "active" : ""}`}
              onClick={() => setSelectedSport(s.slug)}
            >
              {s.name}
            </button>
          ))}
          <button className="cat-tab">Promotions</button>
        </div>

        <div className="market-tabs">
          <span className="mkt-tab active">1x2</span>
          <span className="mkt-tab">Double Chance</span>
          <span className="mkt-tab">Over/Under (J2.5)</span>
        </div>

        {loading && <p className="state-msg">Loading events...</p>}
        {error && <p className="error state-msg">Failed to load: {error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="state-msg">No events match this filter.</p>
        )}

        {grouped
          .filter(([league]) => league === LIVE_BOARD_KEY)
          .map(([league, leagueEvents]) => (
            <Fragment key={league}>
          <div
            className={`league-section ${league === LIVE_BOARD_KEY ? "live-board" : ""}`}
          >
            <div className="table-wrap">
              <table className="odds-table">
                <thead>
                  <tr className="market-group-row">
                    <th></th>
                    <th colSpan={3}>1x2</th>
                    <th colSpan={3}>Double Chance</th>
                    <th colSpan={2}>Over/Under 2.5</th>
                    <th></th>
                  </tr>
                  <tr>
                    <th className="th-event">
                      {league === LIVE_BOARD_KEY ? "Live Football" : "Events"}
                    </th>
                    {ALL_COLUMNS.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th className="th-more">more</th>
                  </tr>
                </thead>
                <tbody>
                  {(league === LIVE_BOARD_KEY
                    ? leagueEvents.slice(
                        (livePage - 1) * LIVE_BOARD_PER_PAGE,
                        livePage * LIVE_BOARD_PER_PAGE
                      )
                    : leagueEvents
                  ).map((event: any) => {
                    const odds = getOdds(event);
                    const eventTime = new Date(event.startTime);
                    const timeStr = eventTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const dateStr = eventTime.toLocaleDateString([], {
                      day: "2-digit",
                      month: "short",
                    });
                    const code = getEventCode(event.id);

                    return (
                      <tr
                        key={event.id}
                        className={event.status === "LIVE" ? "live-row" : ""}
                      >
                        <td className="td-event">
                          <div className="event-info">
                            <img src="/icons/stats.png" alt="" className="event-chart-icon" />
                            <strong className="event-code">{code}</strong>
                            <span className="event-date-badge">
                              <span className="badge-date">{dateStr}</span>
                              <span className="badge-time">{timeStr}</span>
                            </span>
                            <span className="event-teams-col">
                              <span className="team-row">
                                <span className="team-name">{event.homeTeam}</span>
                              </span>
                              <span className="team-row">
                                <span className="team-name">{event.awayTeam}</span>
                              </span>
                            </span>
                          </div>
                        </td>
                        {ALL_COLUMNS.map((col) => {
                          const outcome = (odds as any)[col.key];
                          const sel = outcome ? isSelected(outcome.id) : false;
                          const move = outcome ? movements[outcome.id] : undefined;
                          return (
                            <td
                              key={col.key}
                              data-col={col.label}
                              className={`td-odds ${col.gold ? "gold" : ""} ${sel ? "selected" : ""} ${!outcome ? "empty" : ""} ${move ? `move-${move}` : ""}`}
                              onClick={() =>
                                outcome &&
                                handleOddsClick(
                                  outcome,
                                  col.type === "ou" ? "ou" : "mw",
                                  event
                                )
                              }
                            >
                              <span>{outcome ? outcome.odds.toFixed(2) : "-"}</span>
                            </td>
                          );
                        })}
                        <td className="td-more">
                          <button className="more-btn">{"➡"}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {league === LIVE_BOARD_KEY &&
              leagueEvents.length > LIVE_BOARD_PER_PAGE &&
              (() => {
                const pageCount = Math.ceil(leagueEvents.length / LIVE_BOARD_PER_PAGE);
                return (
                  <div className="pagination">
                    <button
                      className="page-arrow"
                      onClick={() => setLivePage((p) => Math.max(1, p - 1))}
                      disabled={livePage === 1}
                      aria-label="Previous page"
                    >
                      {"‹"}
                    </button>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={`page-num ${p === livePage ? "active" : ""}`}
                        onClick={() => setLivePage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      className="page-arrow"
                      onClick={() => setLivePage((p) => Math.min(pageCount, p + 1))}
                      disabled={livePage === pageCount}
                      aria-label="Next page"
                    >
                      {"›"}
                    </button>
                  </div>
                );
              })()}
          </div>            </Fragment>
          ))}

        <HotGames />
        <MarketFilter />

        {grouped
          .filter(([league]) => league !== LIVE_BOARD_KEY)
          .map(([league, leagueEvents]) => (
            <Fragment key={league}>
          <div
            className={`league-section ${league === LIVE_BOARD_KEY ? "live-board" : ""}`}
          >
            <div className="table-wrap">
              <table className="odds-table">
                <thead>
                  <tr className="market-group-row">
                    <th></th>
                    <th colSpan={3}>1x2</th>
                    <th colSpan={3}>Double Chance</th>
                    <th colSpan={2}>Over/Under 2.5</th>
                    <th></th>
                  </tr>
                  <tr>
                    <th className="th-event">
                      {league === LIVE_BOARD_KEY ? "Live Football" : "Events"}
                    </th>
                    {ALL_COLUMNS.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th className="th-more">more</th>
                  </tr>
                </thead>
                <tbody>
                  {(league === LIVE_BOARD_KEY
                    ? leagueEvents.slice(
                        (livePage - 1) * LIVE_BOARD_PER_PAGE,
                        livePage * LIVE_BOARD_PER_PAGE
                      )
                    : leagueEvents
                  ).map((event: any) => {
                    const odds = getOdds(event);
                    const eventTime = new Date(event.startTime);
                    const timeStr = eventTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const dateStr = eventTime.toLocaleDateString([], {
                      day: "2-digit",
                      month: "short",
                    });
                    const code = getEventCode(event.id);

                    return (
                      <tr
                        key={event.id}
                        className={event.status === "LIVE" ? "live-row" : ""}
                      >
                        <td className="td-event">
                          <div className="event-info">
                            <img src="/icons/stats.png" alt="" className="event-chart-icon" />
                            <strong className="event-code">{code}</strong>
                            <span className="event-date-badge">
                              <span className="badge-date">{dateStr}</span>
                              <span className="badge-time">{timeStr}</span>
                            </span>
                            <span className="event-teams-col">
                              <span className="team-row">
                                <span className="team-name">{event.homeTeam}</span>
                              </span>
                              <span className="team-row">
                                <span className="team-name">{event.awayTeam}</span>
                              </span>
                            </span>
                          </div>
                        </td>
                        {ALL_COLUMNS.map((col) => {
                          const outcome = (odds as any)[col.key];
                          const sel = outcome ? isSelected(outcome.id) : false;
                          const move = outcome ? movements[outcome.id] : undefined;
                          return (
                            <td
                              key={col.key}
                              data-col={col.label}
                              className={`td-odds ${col.gold ? "gold" : ""} ${sel ? "selected" : ""} ${!outcome ? "empty" : ""} ${move ? `move-${move}` : ""}`}
                              onClick={() =>
                                outcome &&
                                handleOddsClick(
                                  outcome,
                                  col.type === "ou" ? "ou" : "mw",
                                  event
                                )
                              }
                            >
                              <span>{outcome ? outcome.odds.toFixed(2) : "-"}</span>
                            </td>
                          );
                        })}
                        <td className="td-more">
                          <button className="more-btn">{"➡"}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {league === LIVE_BOARD_KEY &&
              leagueEvents.length > LIVE_BOARD_PER_PAGE &&
              (() => {
                const pageCount = Math.ceil(leagueEvents.length / LIVE_BOARD_PER_PAGE);
                return (
                  <div className="pagination">
                    <button
                      className="page-arrow"
                      onClick={() => setLivePage((p) => Math.max(1, p - 1))}
                      disabled={livePage === 1}
                      aria-label="Previous page"
                    >
                      {"‹"}
                    </button>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        className={`page-num ${p === livePage ? "active" : ""}`}
                        onClick={() => setLivePage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      className="page-arrow"
                      onClick={() => setLivePage((p) => Math.min(pageCount, p + 1))}
                      disabled={livePage === pageCount}
                      aria-label="Next page"
                    >
                      {"›"}
                    </button>
                  </div>
                );
              })()}
          </div>            </Fragment>
          ))}
      </div>
    </div>
  );
}
