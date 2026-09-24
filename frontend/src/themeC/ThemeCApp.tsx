// Theme C: the "Poccabet Homepage Redesign" design, as its own layout.
// Mobile (<900px): header, sections nav, Home / Live screens, fixed bottom nav, sheets.
// Desktop: header with search, sports & top-leagues sidebar, main screen, bet-slip rail.
import { useState, type ReactNode } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Auth } from "../pages/Auth";
import { MyBets } from "../pages/MyBets";
import { useTCData } from "./data";
import { DesktopHeader, DesktopHome, DesktopLive, Rail, Sidebar } from "./desktop";
import { BottomNav, type HomeTab, MobileHeader, MobileHome, MobileLive, SectionsNav } from "./mobile";
import { AccountSheet, BetSlipBody, MarketsSheet, Sheet, useIsDesktop } from "./shared";
import "./themeC.css";

type View = "home" | "live";

export function ThemeCApp() {
  const desk = useIsDesktop();
  const data = useTCData();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<HomeTab>("upcoming");
  const [market, setMarket] = useState("1x2");
  const [sheet, setSheet] = useState<"markets" | "slip" | "account" | null>(null);
  const [search, setSearch] = useState("");
  const [league, setLeague] = useState<string | null>(null);

  const goHome = (t: "upcoming" | "top" = "upcoming") => { setView("home"); setTab(t); navigate("/"); window.scrollTo(0, 0); };
  const goLive = () => { setView("live"); navigate("/"); window.scrollTo(0, 0); };

  const onRoot = location.pathname === "/";
  const navActive = !onRoot ? (location.pathname === "/my-bets" ? "mybets" : "account") : view;

  const home = desk ? (
    <DesktopHome upcoming={data.upcoming} live={data.live} tab={tab} setTab={setTab} onOpenLive={goLive} search={search} league={league} />
  ) : (
    <MobileHome upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} liveLoaded={data.liveLoaded} tab={tab} setTab={setTab}
      openSheet={() => setSheet("markets")} market={market} setMarket={setMarket} />
  );
  const live = desk ? (
    <DesktopLive live={data.live} onUpcoming={() => goHome("upcoming")} onTop={() => goHome("top")} search={search} league={league} />
  ) : (
    <MobileLive live={data.live} loaded={data.liveLoaded} onUpcoming={() => goHome("upcoming")} onTop={() => goHome("top")}
      openSheet={() => setSheet("markets")} market={market} setMarket={setMarket} />
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
      {!desk && onRoot && <SectionsNav />}

      <Routes>
        <Route path="/" element={desk ? deskShell(view === "live" ? live : home) : view === "live" ? live : home} />
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
    </div>
  );
}
