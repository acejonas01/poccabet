// Themes A (default) and B: the "Poccabet Homepage Redesign" layout. B uses lighter league headers.
// Mobile (<900px): header, sections nav, Home / Live screens, fixed bottom nav, sheets.
// Desktop: header with search, sports & top-leagues sidebar, main screen, bet-slip rail.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { zoned } from "../lib/browser";
import { type TCMatch, matchHref, useTCData } from "./data";
import { DesktopHeader, DesktopHome, DesktopListPage, Rail, Sidebar } from "./desktop";
import { SiteFooter } from "./footer";
import { BottomNav, type HomeTab, MatchListPage, MobileHeader, MobileHome, type SectionKey, SectionsNav } from "./mobile";
import { ACCENT, BetSlipBody, MarketsSheet, useBookingLink, useIsDesktop, useStoredState, useSyncSlipWithFeed } from "./shared";
import { MatchPage } from "./matchpage";
import { SUPPORT_EMAIL, ShortcutsPanel, SupportSheet } from "./shortcuts";
import { LeaguePage, SportListPage, SportPage } from "./sports";
import { RedesignMyBets } from "./mybets";
import { RedesignAccount } from "./account";
import { RedesignForgot, RedesignLogin, RedesignSignup } from "./auth";
import { buildIndex } from "./search";
import { SearchResultsPage } from "./searchui";
import "./redesign.css";


// Back/Forward returns to where you were on that page (e.g. Featured matches on Home), instead of
// keeping the scroll position of the page you came from. New pages still start at the top.
function useScrollMemory(path: string) {
  const positions = useRef(new Map<string, number>());
  const current = useRef(path);
  const popped = useRef(false);
  useEffect(() => {
    const onPop = () => { popped.current = true; };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => positions.current.set(current.current, window.scrollY));
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);
  useLayoutEffect(() => {
    if (current.current === path) return;
    current.current = path;
    if (!popped.current) return;
    popped.current = false;
    const y = positions.current.get(path) ?? 0;
    // Twice: once now, once after the page has laid out (images, lists).
    window.scrollTo(0, y);
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
  }, [path]);
}

export function RedesignApp() {
  const desk = useIsDesktop();
  // Server pages guess the layout from the browser's user agent. If the guess doesn't fit the screen
  // (e.g. a narrow desktop window), redesign.css hides the page until the first render that knows
  // the real width (desk and ready land together).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useLayoutEffect(() => { if (ready) document.documentElement.classList.add("tc-ready"); }, [ready]);
  const data = useTCData();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, notice, clearNotice } = useAuth();
  useScrollMemory(location.pathname + location.search);

  // Remembered until the browser tab is closed, so a reload lands where you were.
  const [tab, setTab] = useStoredState<HomeTab>("pocca-home-tab", "upcoming", "session");
  const [dateId, setDateId] = useStoredState("pocca-home-date", "all", "session");
  const [market, setMarket] = useStoredState("pocca-home-market", "1x2", "session");
  const [sheet, setSheet] = useState<"markets" | "shortcuts" | "support" | null>(null);
  // A shared booking link (/?book=CODE) loads the slip; on phones, open it (desktop shows it in the rail).
  useBookingLink(() => { if (!desk) navigate("/betslip"); });
  // A slip brought back after a reload gets today's prices (and loses games that are over).
  const feedMatches = useMemo(() => [...data.live, ...data.upcoming], [data.live, data.upcoming]);
  useSyncSlipWithFeed(feedMatches, data.upcomingLoaded && data.liveLoaded);
  // Search index over today's feed: teams, leagues and matches (see search.ts).
  const searchIndex = useMemo(() => buildIndex(data.live, data.upcoming), [data.live, data.upcoming]);
  // Tapping a match (row, "+ markets", search result…) opens its page.
  const openMatch = (m: TCMatch) => navigate(matchHref(m));

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
    setDateId(key === "today" ? zoned().toDateString() : "all");
    scrollToList();
  };
  const activeSection: SectionKey = tab === "live" ? "live" : dateId === zoned().toDateString() ? "today" : "sports";
  // Live = Home with the Live tab open, scrolled to the list (featured live match on top).
  const goLive = () => {
    setTab("live");
    navigate("/");
    requestAnimationFrame(() => document.getElementById("tc-list")?.scrollIntoView());
  };

  const onRoot = location.pathname === "/";
  // Sign-up and log-in are full-screen on phones (no header or bottom nav).
  const onAuth = ["/login", "/signup", "/forgot-password"].includes(location.pathname);
  // The bet slip is its own page on phones: full screen under the header, no bottom nav.
  const onSlipPage = location.pathname === "/betslip";
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/"));
  const authPage = (el: ReactNode) => (desk ? <div className="tc-auth-desk">{el}</div> : el);
  const navActive = onRoot ? (tab === "live" ? "live" : "home")
    : location.pathname === "/my-bets" ? "mybets" : location.pathname === "/account" ? "account" : "home";

  const home = desk ? (
    <DesktopHome upcoming={data.upcoming} live={data.live} tab={tab} setTab={setTab} loaded={tab === "live" ? data.liveLoaded : data.upcomingLoaded} />
  ) : (
    <MobileHome upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} liveLoaded={data.liveLoaded} tab={tab} setTab={setTab} dateId={dateId} setDateId={setDateId}
      openSheet={() => setSheet("markets")} onOpenMatch={openMatch}
      market={market} setMarket={setMarket} />
  );

  // Desktop pages keep the three-column shell; other routes get a centred column.
  const deskShell = (main: ReactNode) => (
    <div style={{ display: "flex", gap: 24, padding: 24, alignItems: "flex-start", maxWidth: 1440, margin: "0 auto", boxSizing: "border-box" }}>
      <div className="tc-sidebar-col" style={{ width: 220, flexShrink: 0 }}>
        <Sidebar matches={[...data.live, ...data.upcoming]} />
      </div>
      {main}
      <Rail />
    </div>
  );
  const listProps = {
    upcoming: data.upcoming, live: data.live, loaded: data.upcomingLoaded, market, setMarket,
    openSheet: () => setSheet("markets"), onOpenMatch: openMatch,
  };
  // Mobile keeps the bottom free for the fixed nav and the Betslip ticket that sticks up above it.
  const page = (el: ReactNode) => (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: desk ? 24 : "16px 16px calc(104px + env(safe-area-inset-bottom))" }}>{el}</div>
  );

  return (
    <div className="tc-root" data-layout={desk ? "desk" : "phone"}>
      {desk ? <DesktopHeader searchIndex={searchIndex} onOpenMatch={openMatch} simulated={data.simulated} onSupport={() => setSheet("support")} />
        : !onAuth && <MobileHeader searchIndex={searchIndex} onOpenMatch={openMatch} simulated={data.simulated} />}
      {!desk && onRoot && <SectionsNav active={activeSection} onSelect={onSection} />}

      <Routes>
        <Route path="/" element={desk ? deskShell(home) : home} />
        {/* League and sports pages: the same data, in the mobile or the desktop layout. */}
        <Route path="/league/:slug" element={desk
          ? deskShell(<LeaguePage {...listProps} View={DesktopListPage} />)
          : <LeaguePage {...listProps} View={MatchListPage} />} />
        <Route path="/sports" element={<Navigate to="/sports/football" replace />} />
        <Route path="/sports/:sport" element={desk
          ? deskShell(<SportPage upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} desktop />)
          : <SportPage upcoming={data.upcoming} live={data.live} loaded={data.upcomingLoaded} />} />
        <Route path="/sports/:sport/:view" element={desk
          ? deskShell(<SportListPage {...listProps} View={DesktopListPage} />)
          : <SportListPage {...listProps} View={MatchListPage} />} />
        <Route path="/search" element={desk
          ? deskShell(<SearchResultsPage {...listProps} index={searchIndex} View={DesktopListPage} />)
          : <SearchResultsPage {...listProps} index={searchIndex} View={MatchListPage} />} />
        <Route path="/match/:slug" element={desk
          ? deskShell(<MatchPage matches={feedMatches} loaded={data.upcomingLoaded && data.liveLoaded} desktop />)
          : page(<MatchPage matches={feedMatches} loaded={data.upcomingLoaded && data.liveLoaded} />)} />
        <Route path="/login" element={authPage(<RedesignLogin />)} />
        <Route path="/signup" element={authPage(<RedesignSignup />)} />
        <Route path="/forgot-password" element={authPage(<RedesignForgot />)} />
        <Route path="/my-bets" element={page(<RedesignMyBets />)} />
        <Route path="/betslip" element={desk
          ? page(<div style={{ maxWidth: 480, margin: "0 auto", background: "var(--tc-panel)", border: "1px solid var(--tc-line)", borderRadius: 14, overflow: "hidden" }}><BetSlipBody onBack={back} /></div>)
          : <div className="tc-slip-page"><BetSlipBody onBack={back} /></div>} />
        <Route path="/account" element={page(<RedesignAccount onSupport={() => setSheet("support")} />)} />
        <Route path="*" element={page(<NotFound onHome={goHome} />)} />
      </Routes>
      {desk && <SiteFooter desktop />}

      {!desk && !onAuth && !onSlipPage && (
        <BottomNav
          active={navActive as "home" | "live" | "mybets" | "account"}
          liveCount={data.live.length}
          onHome={() => goHome()}
          onLive={goLive}
          onSlip={() => navigate("/betslip")}
          onMyBets={() => navigate("/my-bets")}
          onAccount={() => navigate(isAuthenticated ? "/account" : "/login")}
        />
      )}

      {sheet === "markets" && (
        <MarketsSheet active={market} onPick={(id) => { setMarket(id); setSheet(null); }} onClose={() => setSheet(null)} />
      )}
      {sheet === "shortcuts" && <ShortcutsPanel onClose={() => setSheet(null)} />}
      {sheet === "support" && <SupportSheet onClose={() => setSheet(null)} />}
      {notice && <SessionEndedDialog code={notice.code} message={notice.message} onClose={() => { clearNotice(); navigate(notice.code === "SESSION_EXPIRED" ? "/login" : "/"); }} />}
    </div>
  );
}

function NotFound({ onHome }: { onHome: () => void }) {
  return (
    <div style={{ padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Page not found</h1>
      <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)" }}>This page doesn't exist or has moved.</p>
      <button onClick={onHome} style={{ marginTop: 8, height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontSize: 14, fontWeight: 800 }}>Go to home</button>
    </div>
  );
}

// Shown when the server ends a session: the account was suspended (or closed) while logged in.
function SessionEndedDialog({ code, message, onClose }: { code: string; message: string; onClose: () => void }) {
  const suspended = code === "ACCOUNT_SUSPENDED";
  const expired = code === "SESSION_EXPIRED";
  return (
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(8,12,15,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="tc-ended-title" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 380, background: "var(--tc-panel)", border: "1px solid var(--tc-line)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
        <h2 id="tc-ended-title" style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>{suspended ? "Account suspended" : expired ? "Please log in again" : "Account closed"}</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--tc-muted)" }}>{expired ? message : `${message} You've been logged out.`}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {suspended && <a href={`mailto:${SUPPORT_EMAIL}`} style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid var(--tc-outline-2)", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Contact support</a>}
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontSize: 14, fontWeight: 800 }}>{expired ? "Log in" : "OK"}</button>
        </div>
      </div>
    </div>
  );
}
