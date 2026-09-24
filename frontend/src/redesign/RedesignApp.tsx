// Themes A (default) and B: the "Poccabet Homepage Redesign" layout. B uses lighter league headers.
// Mobile (<900px): header, sections nav, Home / Live screens, fixed bottom nav, sheets.
// Desktop: header with search, sports & top-leagues sidebar, main screen, bet-slip rail.
import { useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Auth } from "../pages/Auth";
import { MyBets } from "../pages/MyBets";
import { type TCMatch, leagueSlug, useTCData } from "./data";
import { DesktopHeader, DesktopHome, Rail, Sidebar } from "./desktop";
import { BottomNav, type HomeTab, LeaguePage, MobileHeader, MobileHome, type SectionKey, SectionsNav } from "./mobile";
import { AccountSheet, BetSlipBody, MarketsSheet, MatchMarketsSheet, Sheet, useIsDesktop } from "./shared";
import { ShortcutsPanel, SupportSheet } from "./shortcuts";
import { SportListPage, SportPage } from "./sports";
import "./redesign.css";


// Desktop has no separate league page: /league/<slug> shows the home screen filtered to that league.
function DeskLeague({ all, render }: { all: TCMatch[]; render: (league: string | null) => ReactNode }) {
  const { slug = "" } = useParams();
  const m = all.find((x) => leagueSlug(x.country, x.league) === slug);
  return <>{render(m?.league ?? null)}</>;
}

export function RedesignApp() {
  const desk = useIsDesktop();
  const data = useTCData();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [tab, setTab] = useState<HomeTab>("upcoming");
  const [dateId, setDateId] = useState("all");
  const [market, setMarket] = useState("1x2");
  const [sheet, setSheet] = useState<"markets" | "slip" | "account" | "match" | "shortcuts" | "support" | null>(null);
  // Match whose markets sheet is open — looked up live so its odds keep updating.
  const [matchId, setMatchId] = useState<string | null>(null);
  const sheetMatch = matchId ? [...data.live, ...data.upcoming].find((x) => x.id === matchId) : undefined;
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState<string | null>(null);

  const goHome = () => { setTab("upcoming"); setDateId("all"); navigate("/"); window.scrollTo(0, 0); };
  const scrollToList = () => requestAnimationFrame(() => document.getElementById("tc-list")?.scrollIntoView({ behavior: "smooth" }));
  // Quick nav: Sports = back to the default Home (all upcoming) at the top,
  // Live = Live tab, Today = Upcoming filtered to today.
  const onSection = (key: SectionKey) => {
    if (key === "more") return setSheet("shortcuts");
    if (key === "support") return setSheet("support");
    if (key === "sports") {
      setTab("upcoming");
      setDateId("all");
      return window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (key === "live") return goLive();
    setTab("upcoming");
    setDateId(key === "today" ? new Date().toDateString() : "all");
    scrollToList();
  };
  const activeSection: SectionKey = tab === "live" ? "live" : dateId === new Date().toDateString() ? "today" : "sports";
  // Live = Home with the Live tab open, scrolled to the list (featured live match on top).
  const goLive = () => {
    setTab("live");
    navigate("/");
    requestAnimationFrame(() => document.getElementById("tc-list")?.scrollIntoView());
  };

  const onRoot = location.pathname === "/";
  const onLeague = location.pathname.startsWith("/league/") || location.pathname.startsWith("/sports");
  const navActive = onLeague ? "home" : !onRoot ? (location.pathname === "/my-bets" ? "mybets" : "account") : tab === "live" ? "live" : "home";

  const home = desk ? (
    <DesktopHome upcoming={data.upcoming} live={data.live} tab={tab} setTab={setTab} search={search} league={league} />
  ) : (
    <MobileHome upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} liveLoaded={data.liveLoaded} tab={tab} setTab={setTab} dateId={dateId} setDateId={setDateId}
      openSheet={() => setSheet("markets")} onOpenMatch={(m) => { setMatchId(m.id); setSheet("match"); }}
      market={market} setMarket={setMarket} />
  );

  // Desktop pages keep the three-column shell; other routes get a centred column.
  const deskShell = (main: ReactNode) => (
    <div style={{ display: "flex", gap: 24, padding: 24, alignItems: "flex-start", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
      <div className="tc-sidebar-col" style={{ width: 220, flexShrink: 0 }}>
        <Sidebar footballCount={data.upcoming.length + data.live.length} league={league} setLeague={setLeague} />
      </div>
      {main}
      <Rail />
    </div>
  );
  const page = (el: ReactNode) => (
    <div className={desk ? undefined : "tc-mobile-page"} style={{ maxWidth: 720, margin: "0 auto", padding: desk ? 24 : 16 }}>{el}</div>
  );

  return (
    <div className="tc-root">
      {desk ? <DesktopHeader search={search} setSearch={setSearch} simulated={data.simulated} /> : <MobileHeader simulated={data.simulated} />}
      {!desk && onRoot && <SectionsNav active={activeSection} onSelect={onSection} />}

      <Routes>
        <Route path="/" element={desk ? deskShell(home) : home} />
        <Route path="/league/:slug" element={desk
          ? <DeskLeague render={(name) => deskShell(<DesktopHome upcoming={data.upcoming} live={data.live} tab="upcoming" setTab={setTab} search={search} league={name} />)} all={[...data.live, ...data.upcoming]} />
          : <LeaguePage upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} market={market} setMarket={setMarket}
              openSheet={() => setSheet("markets")} onOpenMatch={(m) => { setMatchId(m.id); setSheet("match"); }} />} />
        {/* Sports pages are mobile-only for now; desktop keeps its sidebar and goes home. */}
        <Route path="/sports" element={<Navigate to="/sports/football" replace />} />
        <Route path="/sports/:sport" element={desk ? <Navigate to="/" replace /> : <SportPage upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} />} />
        <Route path="/sports/:sport/:view" element={desk ? <Navigate to="/" replace /> : (
          <SportListPage upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} market={market} setMarket={setMarket}
            openSheet={() => setSheet("markets")} onOpenMatch={(m) => { setMatchId(m.id); setSheet("match"); }} />
        )} />
        <Route path="/login" element={page(<Auth mode="login" />)} />
        <Route path="/signup" element={page(<Auth mode="signup" />)} />
        <Route path="/my-bets" element={page(<MyBets />)} />
      </Routes>

      {!desk && (
        <BottomNav
          active={navActive as "home" | "live" | "mybets" | "account"}
          liveCount={data.live.length}
          onHome={() => goHome()}
          onLive={goLive}
          onSlip={() => setSheet("slip")}
          onMyBets={() => navigate("/my-bets")}
          onAccount={() => (isAuthenticated ? setSheet("account") : navigate("/login"))}
        />
      )}

      {sheet === "markets" && (
        <MarketsSheet active={market} onPick={(id) => { setMarket(id); setSheet(null); }} onClose={() => setSheet(null)} />
      )}
      {sheet === "slip" && (
        <Sheet label="Bet slip" onClose={() => setSheet(null)}>
          <BetSlipBody inSheet />
        </Sheet>
      )}
      {sheet === "account" && <AccountSheet onClose={() => setSheet(null)} />}
      {sheet === "match" && sheetMatch && <MatchMarketsSheet m={sheetMatch} onClose={() => setSheet(null)} />}
      {sheet === "shortcuts" && <ShortcutsPanel onClose={() => setSheet(null)} />}
      {sheet === "support" && <SupportSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
