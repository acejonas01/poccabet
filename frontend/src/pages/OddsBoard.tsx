import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const USE_LIVE_ODDS = true;

export const LIVE_BOARD_KEY = "__liveboard";
const LIVE_BOARD_PER_PAGE = 5;
const LIVE_BOARD_SIZE = 15;

function applyLiveBoard(list: any[]) {
  if (list.length === 0) return list;
  const featured = new Set(
    list.filter((e) => e.sport?.slug === "football" || e.sport?.slug?.startsWith("soccer"))
      .slice(0, LIVE_BOARD_SIZE).map((e) => e.id)
  );
  return list.map((e) =>
    featured.has(e.id) ? { ...e, league: LIVE_BOARD_KEY, status: "SCHEDULED" } : e
  );
}

function normalizeLiveEvent(evt: any, index: number) {
  return {
    id: evt.externalId || `live-${index}`,
    sport: { slug: evt.sport, name: evt.league },
    league: evt.league,
    homeTeam: evt.homeTeam,
    awayTeam: evt.awayTeam,
    startTime: evt.startTime,
    status: "SCHEDULED",
    markets: (evt.markets || []).map((m: any, mi: number) => ({
      id: `${evt.externalId}-m${mi}`,
      type: m.type,
      name: m.name,
      outcomes: (m.outcomes || []).map((o: any, oi: number) => ({
        id: `${evt.externalId}-m${mi}-o${oi}`,
        label: o.label,
        odds: o.odds,
      })),
    })),
  };
}

// API-Football live fixture -> board event (reuses the odds normalizer for markets).
function normalizeLiveFixture(f: any, index: number) {
  return {
    ...normalizeLiveEvent({ ...f, externalId: `af-${f.externalId}`, sport: "football" }, index),
    status: "LIVE",
    minute: f.minute,
    period: f.status,
    homeGoals: f.homeGoals,
    awayGoals: f.awayGoals,
  };
}

// Last good feed saved on the device so tabs render instantly on the next visit,
// then refresh in the background. Storage can be unavailable (private mode), so never throw.
const FEED_MAX_AGE = { live: 5 * 60000, upcoming: 3 * 3600000, results: 3 * 3600000 };
type FeedName = keyof typeof FEED_MAX_AGE;

function readFeed(name: FeedName): any[] {
  try {
    const { at, data } = JSON.parse(localStorage.getItem(`pocca-feed-${name}`) ?? "null") ?? {};
    const sameDay = new Date(at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    return Array.isArray(data) && Date.now() - at < FEED_MAX_AGE[name] && sameDay ? data : [];
  } catch {
    return [];
  }
}

function saveFeed(name: FeedName, data: any[]) {
  try {
    localStorage.setItem(`pocca-feed-${name}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore — cache is a convenience only
  }
  return data;
}

// API-Football finished game -> board event (no markets).
function normalizeResult(r: any) {
  return {
    id: r.externalId,
    sport: { slug: "football", name: "Football" },
    league: r.league,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    startTime: r.startTime,
    status: "FINISHED",
    period: r.status,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
    markets: [],
  };
}

export function OddsBoard() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("all");
  const [activeSlide, setActiveSlide] = useState(0);
  const [trackIndex, setTrackIndex] = useState(1);
  const [animating, setAnimating] = useState(true);
  const [movements, setMovements] = useState<Record<string, "up" | "down">>({});
  const [livePage, setLivePage] = useState(1);
  const [catTab, setCatTab] = useState("live");
  const [liveEvents, setLiveEvents] = useState<any[]>(() => readFeed("live"));
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>(() => readFeed("upcoming"));
  const [upcomingLoaded, setUpcomingLoaded] = useState(false);
  const [resultEvents, setResultEvents] = useState<any[]>(() => readFeed("results"));
  const [resultsLoaded, setResultsLoaded] = useState(false);
  // Backend is serving generated games (FEED_MODE=simulation) — flag it in the UI.
  const [_simulated, setSimulated] = useState(false); // read by the DEMO pill (hidden for now)
  const showLiveBoard = catTab === "live" || catTab === "upcoming";
  // HIGHLIGHTS reuses the board for today's finished games (scores only, no odds).
  const showBoard = showLiveBoard || catTab === "highlights";
  const showOdds = catTab !== "highlights";
  const prevOdds = useRef<Record<string, number>>({});
  const slideInterval = useRef<ReturnType<typeof setInterval>>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { selectedSport, selectedLeague, liveOnly, setSelectedSport } = useFilter();
  const { selections, addSelection } = useBetSlip();

  const loopSlides = useMemo(() => [
    PROMO_SLIDES[PROMO_SLIDES.length - 1],
    ...PROMO_SLIDES,
    PROMO_SLIDES[0],
  ], []);

  const resetAutoplay = useCallback(() => {
    if (slideInterval.current) clearInterval(slideInterval.current);
    slideInterval.current = setInterval(() => {
      setTrackIndex((t) => Math.min(t + 1, loopSlides.length - 1));
      setAnimating(true);
    }, 5000);
  }, [loopSlides.length]);

  useEffect(() => {
    resetAutoplay();
    // Hidden tabs skip transitionend, so pause autoplay and snap back to a real slide on return.
    const onVisibility = () => {
      if (document.hidden) {
        if (slideInterval.current) clearInterval(slideInterval.current);
        return;
      }
      setAnimating(false);
      setTrackIndex((t) => ((t - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length) + 1);
      resetAutoplay();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (slideInterval.current) clearInterval(slideInterval.current);
    };
  }, [resetAutoplay]);

  useEffect(() => {
    if (!animating) return;
    const el = trackRef.current;
    if (!el) return;
    const handler = () => {
      if (trackIndex <= 0) {
        setAnimating(false);
        setTrackIndex(PROMO_SLIDES.length);
      } else if (trackIndex >= loopSlides.length - 1) {
        setAnimating(false);
        setTrackIndex(1);
      }
      setActiveSlide((trackIndex - 1 + PROMO_SLIDES.length) % PROMO_SLIDES.length);
    };
    el.addEventListener("transitionend", handler);
    return () => el.removeEventListener("transitionend", handler);
  }, [trackIndex, animating, loopSlides.length]);

  function goToSlide(i: number) {
    setTrackIndex(i + 1);
    setActiveSlide(i);
    setAnimating(true);
    resetAutoplay();
  }

  function slideNext() {
    setTrackIndex((t) => Math.min(t + 1, loopSlides.length - 1));
    setAnimating(true);
    resetAutoplay();
  }

  function slidePrev() {
    setTrackIndex((t) => Math.max(t - 1, 0));
    setAnimating(true);
    resetAutoplay();
  }

  const touchStart = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
    setAnimating(false);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (touchStart.current === null) return;
    touchDelta.current = e.touches[0].clientX - touchStart.current;
    setDragOffset(touchDelta.current);
  }
  function onTouchEnd() {
    touchStart.current = null;
    setDragOffset(0);
    setAnimating(true);
    if (touchDelta.current < -40) slideNext();
    else if (touchDelta.current > 40) slidePrev();
    touchDelta.current = 0;
  }

  useEffect(() => {
    if (USE_LIVE_ODDS) {
      api
        .getLiveOdds()
        .then((res) => {
          // Empty feed (e.g. provider out of credits) falls back to DB events.
          if (res.events.length === 0) throw new Error("empty odds feed");
          const normalized = res.events.map(normalizeLiveEvent);
          setEvents(applyLiveBoard(normalized));
        })
        .catch(() => {
          api
            .getEvents()
            .then((res) => setEvents(applyLiveBoard(res.events)))
            .catch((err) => setError(err.message));
        })
        .finally(() => setLoading(false));
    } else {
      api
        .getEvents()
        .then((res) => setEvents(applyLiveBoard(res.events)))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (USE_LIVE_ODDS) {
        api.getLiveOdds().then((res) => {
          if (res.events.length === 0) return;
          const normalized = res.events.map(normalizeLiveEvent);
          setEvents(applyLiveBoard(normalized));
        }).catch(() => {});
      } else {
        api.getEvents().then((res) => setEvents(res.events)).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Real in-play games. The backend caches API-Football, so polling here costs no credits.
  useEffect(() => {
    const load = () =>
      api
        .getLiveFixtures()
        .then((res) => {
          setSimulated(!!res.simulated);
          setLiveEvents(saveFeed("live", res.fixtures.map(normalizeLiveFixture)));
        })
        .catch(() => {})
        .finally(() => setLiveLoaded(true));
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  // Upcoming games from API-Football (backend caches for hours, so this poll is free).
  useEffect(() => {
    const load = () =>
      api
        .getUpcomingFixtures()
        .then((res) => setUpcomingEvents(saveFeed("upcoming", res.events.map(normalizeLiveEvent))))
        .catch(() => {})
        .finally(() => setUpcomingLoaded(true));
    // Results share the same backend refresh, so this costs no extra API calls.
    const loadResults = () =>
      api
        .getResults()
        .then((res) => setResultEvents(saveFeed("results", res.results.map(normalizeResult))))
        .catch(() => {})
        .finally(() => setResultsLoaded(true));
    load();
    loadResults();
    const id = setInterval(() => { load(); loadResults(); }, 10 * 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const current: Record<string, number> = {};
    const moved: Record<string, "up" | "down"> = {};

    for (const e of [...events, ...liveEvents, ...upcomingEvents]) {
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
  }, [events, liveEvents, upcomingEvents]);

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

  // LIVE = real in-play games; UPCOMING = real games that haven't kicked off yet.
  // The upcoming feed is cached for hours, so drop games whose kickoff has passed.
  const boardEvents =
    catTab === "live"
      ? liveEvents
      : catTab === "highlights"
        ? resultEvents
        : upcomingEvents.filter((e) => new Date(e.startTime).getTime() > Date.now());

  const boardLoading =
    (catTab === "live" && !liveLoaded) ||
    (catTab === "upcoming" && !upcomingLoaded) ||
    (catTab === "highlights" && !resultsLoaded);

  function selectCatTab(tab: string, sport = "all") {
    setCatTab(tab);
    setSelectedSport(sport);
    setLivePage(1);
  }

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

  return (
    <div className="odds-page">

      {/* ===== S3 · QuickNav ===== */}
      <div className="quick-nav">
        {[
          { label: "Football", icon: "/icons/soccer-ball.png", color: false },
          { label: "Live", icon: "/icons/live-3.png", color: false },
          { label: "Aviator", icon: "/icons/aviator.png", color: false },
          { label: "Virtuals", icon: "/icons/visuals.png", color: false },
          { label: "Today", icon: "/icons/today.png", color: false },
          { label: "Jackpot", icon: "/icons/jackpot.png", color: false },
          { label: "Casino", icon: "/icons/casino.png", color: true },
          { label: "Specials", icon: "/icons/Specials.png", color: true },
        ].map((item) => (
          <a key={item.label} className="quick-nav-item" href="#">
            <span className="quick-nav-icon">
              <img src={item.icon} alt={item.label} className={`quick-nav-img${item.color ? "" : " quick-nav-img--muted"}`} />
            </span>
            <span className="quick-nav-label">{item.label}</span>
          </a>
        ))}
      </div>

      <div className="promo-section">
      {/* ===== S4 · PromoCarousel ===== */}
      <div className="promo-carousel"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          className="promo-track"
          style={{
            transform: `translateX(calc(-${trackIndex} * var(--slide-w) + var(--slide-offset) + ${dragOffset}px))`,
            transition: animating ? "transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)" : "none",
          }}
        >
          {loopSlides.map((src, i) => (
            <div key={i} className="promo-slide">
              {/* Phones get the 1080×400 mobile artwork; desktop keeps the wide banner */}
              <picture>
                <source media="(max-width: 900px)" srcSet={src.replace(".jpg", "-m.jpg")} />
                <img src={src} alt="Promo" />
              </picture>
            </div>
          ))}
        </div>
        <button
          className="promo-arrow promo-arrow-left"
          onClick={slidePrev}
          aria-label="Previous slide"
        >
          {"❮"}
        </button>
        <button
          className="promo-arrow promo-arrow-right"
          onClick={slideNext}
          aria-label="Next slide"
        >
          {"❯"}
        </button>
      </div>

      {/* ===== S5 · PromoDots ===== */}
      <div className="promo-dots">
        {["⚽", "🏈", "🎾", "🏀", "🥊"].map((icon, i) => (
          <button
            key={i}
            className={`promo-dot ${activeSlide === i ? "active" : ""}`}
            onClick={() => goToSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
          >
            {icon}
          </button>
        ))}
      </div>
      </div>

      <div className="section-block">
        {/* ===== S6 · PopularBetsHeader ===== */}
        <div className="section-title-row">
          <h2 className="section-title">Popular Bets</h2>
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

        {/* ===== S7 · CategoryTabs ===== */}
        <div className="category-tabs">
          <button
            className={`cat-tab ${catTab === "live" ? "active" : ""}`}
            onClick={() => selectCatTab("live")}
          >
            Live
          </button>
          <button
            className={`cat-tab ${catTab === "upcoming" ? "active" : ""}`}
            onClick={() => selectCatTab("upcoming")}
          >
            Upcoming
          </button>
          <button
            className={`cat-tab ${catTab === "highlights" ? "active" : ""}`}
            onClick={() => selectCatTab("highlights")}
          >
            Highlights
          </button>
          <button className="cat-tab"><span className="cat-tab-brand">Pocca</span><span className="news-accent">Sports</span></button>
          {sports.map((s) => (
            <button
              key={s.slug}
              className={`cat-tab ${catTab === s.slug ? "active" : ""}`}
              onClick={() => selectCatTab(s.slug, s.slug)}
            >
              {s.name}
            </button>
          ))}
          <button className="cat-tab">Promotions</button>
        </div>

        {/* ===== S8 · MarketTabs (LIVE + UPCOMING tabs) ===== */}
        {showLiveBoard && (
          <div className="market-tabs">
            <span className="mkt-tab active">1x2</span>
            <span className="mkt-tab">Double Chance</span>
            <span className="mkt-tab">Over/Under (J2.5)</span>
          </div>
        )}

        {loading && !showBoard && <p className="state-msg">Loading events...</p>}
        {error && <p className="error state-msg">Failed to load: {error}</p>}
        {!loading && !error && !showBoard && filtered.length === 0 && (
          <p className="state-msg">No events match this filter.</p>
        )}

        {/* ===== S9 · LiveBoard (LIVE + UPCOMING tabs) ===== */}
        {showLiveBoard && catTab === "live" && liveLoaded && liveEvents.length === 0 && (
          <p className="state-msg">No live games right now.</p>
        )}
        {showLiveBoard && catTab === "upcoming" && upcomingLoaded && boardEvents.length === 0 && (
          <p className="state-msg">No upcoming games right now.</p>
        )}
        {catTab === "highlights" && resultsLoaded && resultEvents.length === 0 && (
          <p className="state-msg">No finished games yet today.</p>
        )}
        {showBoard && boardLoading && boardEvents.length === 0 && (
          <div className="board-skeleton" aria-label="Loading games" role="status">
            {Array.from({ length: 5 }, (_, i) => (
              <div className="skel-row" key={i}>
                <span className="skel skel-badge" />
                <span className="skel-teams">
                  <span className="skel skel-line" />
                  <span className="skel skel-line short" />
                </span>
                {showOdds && Array.from({ length: 3 }, (_, j) => <span className="skel skel-odds" key={j} />)}
              </div>
            ))}
          </div>
        )}
        {showBoard && boardEvents.length > 0 && (
              <div className="league-section live-board">
                <table className="odds-table odds-table-head">
                  <thead>
                    {showOdds && (
                      <tr className="market-group-row">
                        <th></th>
                        <th colSpan={3}>1x2</th>
                        <th colSpan={3}>Double Chance</th>
                        <th colSpan={2}>Over/Under 2.5</th>
                        <th></th>
                      </tr>
                    )}
                    <tr>
                      <th className="th-event">
                        <img src="/icons/stream.png" alt="" className="live-icon" /> {{ live: "Live Football", upcoming: "Upcoming Football", highlights: "Today's Results" }[catTab]}
                        {/* {_simulated && <span className="demo-pill">DEMO</span>} */}
                      </th>
                      {showOdds && ALL_COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      {showOdds && <th className="th-more">more</th>}
                    </tr>
                  </thead>
                </table>

                <div className="live-slider-wrap">
                  {(() => {
                    const pageCount = Math.ceil(boardEvents.length / LIVE_BOARD_PER_PAGE);
                    return (
                      <div
                        className="live-slider-track"
                        style={{
                          width: `${pageCount * 100}%`,
                          transform: `translateX(-${((livePage - 1) / pageCount) * 100}%)`,
                        }}
                      >
                        {Array.from({ length: pageCount }, (_, pageIdx) => (
                          <div className="live-slider-page" key={pageIdx}>
                            <table className="odds-table odds-table-body">
                              <tbody>
                                {boardEvents
                                  .slice(pageIdx * LIVE_BOARD_PER_PAGE, (pageIdx + 1) * LIVE_BOARD_PER_PAGE)
                                  .map((event: any) => {
                                    const odds = getOdds(event);
                                    const eventTime = new Date(event.startTime);
                                    const timeStr = eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                    const dateStr = eventTime.toLocaleDateString([], { day: "2-digit", month: "short" });
                                    const code = getEventCode(event.id);
                                    return (
                                      <tr key={event.id}>
                                        <td className="td-event">
                                          <div className={`event-info ${event.status === "LIVE" || event.status === "FINISHED" ? "has-score" : ""}`}>
                                            <img src="/icons/stats.png" alt="" className="event-chart-icon" />
                                            <strong className="event-code">{code}</strong>
                                            {event.status === "LIVE" ? (
                                              <span className="event-date-badge is-live">
                                                <span className="badge-date">LIVE</span>
                                                <span className="badge-time">{event.period === "HT" ? "HT" : `${event.minute ?? 0}'`}</span>
                                              </span>
                                            ) : event.status === "FINISHED" ? (
                                              <span className="event-date-badge is-ft">
                                                <span className="badge-date">{event.period}</span>
                                                <span className="badge-time">{timeStr}</span>
                                              </span>
                                            ) : (
                                              <span className="event-date-badge">
                                                <span className="badge-date">{dateStr}</span>
                                                <span className="badge-time">{timeStr}</span>
                                              </span>
                                            )}
                                            <span className="event-teams-col">
                                              <span className="team-row"><span className="team-name">{event.homeTeam}</span></span>
                                              <span className="team-row"><span className="team-name">{event.awayTeam}</span></span>
                                            </span>
                                            {(event.status === "LIVE" || event.status === "FINISHED") && (
                                              <span className="event-score">
                                                <span>{event.homeGoals ?? 0}</span>
                                                <span>{event.awayGoals ?? 0}</span>
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        {showOdds && ALL_COLUMNS.map((col) => {
                                          const outcome = (odds as any)[col.key];
                                          const sel = outcome ? isSelected(outcome.id) : false;
                                          const move = outcome ? movements[outcome.id] : undefined;
                                          return (
                                            <td
                                              key={col.key}
                                              data-col={col.label}
                                              className={`td-odds ${col.gold ? "gold" : ""} ${sel ? "selected" : ""} ${!outcome ? "empty" : ""} ${move ? `move-${move}` : ""}`}
                                              onClick={() => outcome && handleOddsClick(outcome, col.type === "ou" ? "ou" : "mw", event)}
                                            >
                                              {outcome ? (
                                                <span>{outcome.odds.toFixed(2)}</span>
                                              ) : event.status === "LIVE" ? (
                                                // Live market closed/suspended — show a lock instead of a dash
                                                <span className="odds-locked" aria-label="Market locked">
                                                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" /></svg>
                                                </span>
                                              ) : (
                                                <span>-</span>
                                              )}
                                            </td>
                                          );
                                        })}
                                        {showOdds && (
                                          <td className="td-more">
                                            <button className="more-btn"><img src="/icons/arrow-right.png" alt="" className="more-btn-icon" /></button>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {boardEvents.length > LIVE_BOARD_PER_PAGE &&
                  (() => {
                    const pageCount = Math.ceil(boardEvents.length / LIVE_BOARD_PER_PAGE);
                    return (
                      <div className="pagination">
                        <button className="page-arrow" onClick={() => setLivePage((p) => Math.max(1, p - 1))} disabled={livePage === 1} aria-label="Previous page">{"‹"}</button>
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                          <button key={p} className={`page-num ${p === livePage ? "active" : ""}`} onClick={() => setLivePage(p)}>{p}</button>
                        ))}
                        <button className="page-arrow" onClick={() => setLivePage((p) => Math.min(pageCount, p + 1))} disabled={livePage === pageCount} aria-label="Next page">{"›"}</button>
                      </div>
                    );
                  })()}
              </div>
        )}

        {/* ===== S10 · HotGames ===== */}
        <HotGames />
        <MarketFilter />

        {grouped
          .filter(([league]) => league !== LIVE_BOARD_KEY)
          .map(([league, leagueEvents]) => (
            <div className="league-section" key={league}>
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
                      <th className="th-event">Events</th>
                      {ALL_COLUMNS.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      <th className="th-more">more</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueEvents.map((event: any) => {
                      const odds = getOdds(event);
                      const eventTime = new Date(event.startTime);
                      const timeStr = eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      const dateStr = eventTime.toLocaleDateString([], { day: "2-digit", month: "short" });
                      const code = getEventCode(event.id);
                      return (
                        <tr key={event.id}>
                          <td className="td-event">
                            <div className="event-info">
                              <img src="/icons/stats.png" alt="" className="event-chart-icon" />
                              <strong className="event-code">{code}</strong>
                              <span className="event-date-badge">
                                <span className="badge-date">{dateStr}</span>
                                <span className="badge-time">{timeStr}</span>
                              </span>
                              <span className="event-teams-col">
                                <span className="team-row"><span className="team-name">{event.homeTeam}</span></span>
                                <span className="team-row"><span className="team-name">{event.awayTeam}</span></span>
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
                                onClick={() => outcome && handleOddsClick(outcome, col.type === "ou" ? "ou" : "mw", event)}
                              >
                                <span>{outcome ? outcome.odds.toFixed(2) : "-"}</span>
                              </td>
                            );
                          })}
                          <td className="td-more">
                            <button className="more-btn"><img src="/icons/arrow-right.png" alt="" className="more-btn-icon" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
