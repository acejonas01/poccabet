import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  type TCMatch, TOP_LEAGUES, dateOptions, groupByLeague, kickoff, leagueRank, matchesDate,
} from "./data";
import {
  AviatorIcon, CasinoIcon, ChevronDown, ChevronRight, GridIcon, HomeIcon, JackpotIcon, LiveIcon, MoonIcon,
  ReceiptIcon, SportsIcon, StarIcon, TicketShape, TrackerIcon, UserIcon, VirtualsIcon,
} from "./icons";
import { FIXED, deriveOdds, impliedPct, marketCount, marketDef } from "./markets";
import { ACCENT, DemoTag, OddButton, WELCOME_BONUS_AMOUNT, usePicker } from "./shared";
import { Crest, Flag, HotGamesStrip, PromoSlider } from "./media";
import { type PickOfDay, usePickOfTheDay } from "./potd";

const barlow = "'Barlow Condensed', sans-serif";
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// ---------- header ----------
export function MobileHeader({ simulated }: { simulated: boolean }) {
  const { isAuthenticated, balance, logout } = useAuth();
  const { cycleTheme } = useTheme();
  const navigate = useNavigate();
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #2E3A41", position: "sticky", top: 0, zIndex: 30, background: "#222c32" }}>
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#F2F4F6" }}>
        <span style={{ fontFamily: barlow, fontStyle: "italic", fontWeight: 700, fontSize: 32, letterSpacing: -0.5, lineHeight: 1 }}>
          Pocca<span style={{ color: ACCENT }}>bet</span>
        </span>
        {simulated && <DemoTag />}
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button aria-label="Switch theme" onClick={cycleTheme} style={{ width: 44, height: 44, borderRadius: 22, border: "1px solid #2E3640", background: "transparent", color: "#A9B2BD", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MoonIcon />
        </button>
        {isAuthenticated ? (
          <>
            <span style={{ height: 44, padding: "0 12px", borderRadius: 10, border: "1px solid #3A434E", color: "#F2F4F6", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center" }}>₦{balance.toFixed(2)}</span>
            <button onClick={logout} style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontWeight: 800, fontSize: 15 }}>Log out</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate("/signup")} style={{ height: 44, padding: "0 16px", borderRadius: 10, border: "1px solid #3A434E", background: "transparent", color: "#F2F4F6", fontWeight: 700, fontSize: 15 }}>Join</button>
            <button onClick={() => navigate("/login")} style={{ height: 44, padding: "0 18px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontWeight: 800, fontSize: 15 }}>Login</button>
          </>
        )}
      </div>
    </header>
  );
}

// ---------- sections nav (Sports / Aviator / Virtuals / Jackpot / Casino) ----------
const SECTIONS = [
  { label: "Sports", Icon: SportsIcon },
  { label: "Aviator", Icon: AviatorIcon },
  { label: "Virtuals", Icon: VirtualsIcon },
  { label: "Jackpot", Icon: JackpotIcon },
  { label: "Casino", Icon: CasinoIcon },
];
export function SectionsNav() {
  return (
    <nav aria-label="Sections" style={{ display: "flex", gap: 2, padding: "8px 8px 0", borderBottom: "1px solid #232A33" }}>
      {SECTIONS.map(({ label, Icon }, i) => {
        const on = i === 0;
        return (
          <button key={label} style={{
            flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0 10px",
            background: "transparent", border: "none", borderBottom: `2px solid ${on ? ACCENT : "transparent"}`,
            color: on ? ACCENT : "#A9B2BD", fontSize: 12, fontWeight: on ? 700 : 600,
          }}>
            <Icon />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------- bottom nav ----------
type NavKey = "home" | "live" | "mybets" | "account" | null;
export function BottomNav({ active, liveCount, onHome, onLive, onSlip, onMyBets, onAccount }: {
  active: NavKey; liveCount: number; onHome: () => void; onLive: () => void; onSlip: () => void; onMyBets: () => void; onAccount: () => void;
}) {
  const { count, total } = usePicker();
  const item = (key: NavKey, label: string, icon: React.ReactNode, onClick: () => void) => {
    const on = active === key;
    return (
      <a href="#" aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); onClick(); }} style={{
        position: "relative", flex: 1, height: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 4, textDecoration: "none", color: on ? ACCENT : "#A9B2BD", fontSize: 11, fontWeight: on ? 800 : 600,
      }}>
        {on && <span style={{ position: "absolute", top: 0, left: "50%", width: 28, height: 3, marginLeft: -14, borderRadius: "0 0 3px 3px", background: ACCENT }} />}
        <span style={{ position: "relative", display: "flex" }}>{icon}</span>
        {label}
      </a>
    );
  };
  return (
    <nav aria-label="Main" style={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, display: "flex", alignItems: "stretch",
      padding: "0 4px calc(20px + env(safe-area-inset-bottom))", background: "#1B2429", borderTop: "1px solid #2E3A41", boxShadow: "0 -8px 24px rgba(0,0,0,0.35)",
    }}>
      {item("home", "Home", <HomeIcon />, onHome)}
      {item("live", "Live", <>
        <LiveIcon />
        {liveCount > 0 && <span style={{ position: "absolute", top: -4, right: -12, padding: "0 5px", height: 16, borderRadius: 8, background: "#E5484D", color: "#FFFFFF", fontSize: 10, fontWeight: 800, lineHeight: "16px" }}>{liveCount}</span>}
      </>, onLive)}
      <a href="#" aria-label={`Betslip, ${count} selections`} onClick={(e) => { e.preventDefault(); onSlip(); }} style={{
        flex: 1, height: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4,
        paddingBottom: 8, boxSizing: "border-box", textDecoration: "none", color: "#F2F4F6", fontSize: 11, fontWeight: 800,
      }}>
        <span style={{ position: "relative", width: 68, height: 46, marginTop: -26, filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.45))" }}>
          <TicketShape accent={ACCENT} />
          <span style={{ position: "absolute", left: 20, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontSize: 26, fontWeight: 700, color: "#13171C" }}>{count}</span>
        </span>
        <span style={{ whiteSpace: "nowrap" }}>{count ? `Odds ${total.toFixed(2)}` : "Betslip"}</span>
      </a>
      {item("mybets", "My bets", <ReceiptIcon />, onMyBets)}
      {item("account", "Account", <UserIcon />, onAccount)}
    </nav>
  );
}

// ---------- shared mobile pieces ----------
function TopTabs({ current, liveCount, onLive, onUpcoming, onTop, right, liveTall }: {
  current: "live" | "upcoming" | "top"; liveCount: number; onLive: () => void; onUpcoming: () => void; onTop: () => void;
  right?: React.ReactNode; liveTall?: boolean;
}) {
  const h = liveTall ? 48 : 44;
  const tab = (on: boolean, color = ACCENT): CSSProperties => ({
    height: h, padding: 0, background: "transparent", border: "none", borderBottom: `2px solid ${on ? color : "transparent"}`,
    color: on ? "#F2F4F6" : "#A9B2BD", fontSize: 15, fontWeight: on ? 800 : 700, whiteSpace: "nowrap", flexShrink: 0,
  });
  return (
    <div className="tc-hscroll" style={{ marginTop: liveTall ? 0 : 20, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, overflowX: "auto", borderBottom: `1px solid ${liveTall ? "#2E3A41" : "#232A33"}` }}>
      <div role="tablist" style={{ display: "flex", gap: 20, flexShrink: 0 }}>
        <button role="tab" aria-selected={current === "live"} onClick={onLive} style={{ ...tab(current === "live", "#E5484D"), display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: liveTall ? 8 : 7, height: liveTall ? 8 : 7, borderRadius: 4, background: "#E5484D", boxShadow: "0 0 0 3px rgba(229,72,77,0.25)" }} />
          Live <span style={{ padding: "1px 7px", borderRadius: 9, background: "#E5484D", color: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>{liveCount}</span>
        </button>
        <button role="tab" aria-selected={current === "upcoming"} onClick={onUpcoming} style={tab(current === "upcoming")}>Upcoming</button>
        <button role="tab" aria-selected={current === "top"} onClick={onTop} style={tab(current === "top")}>Top leagues</button>
      </div>
      {right}
    </div>
  );
}

function MarketTabs({ market, setMarket, openSheet }: { market: string; setMarket: (id: string) => void; openSheet: () => void }) {
  const rowIds = FIXED.includes(market) ? FIXED : ["1x2", "ou", "gg", market];
  return (
    <div role="tablist" aria-label="Markets" className="tc-hscroll" style={{ display: "flex", alignItems: "stretch", gap: 18, height: 40, padding: "0 16px", marginTop: 4, overflowX: "auto", whiteSpace: "nowrap" }}>
      {rowIds.map((id) => {
        const on = id === market;
        return (
          <button key={id} role="tab" aria-selected={on} onClick={() => setMarket(id)} style={{
            flexShrink: 0, padding: 0, background: "transparent", border: "none", borderBottom: `2px solid ${on ? ACCENT : "transparent"}`,
            color: on ? "#F2F4F6" : "#8B95A1", fontSize: 13, fontWeight: on ? 800 : 600,
          }}>{marketDef(id).label}</button>
        );
      })}
      <button aria-haspopup="dialog" onClick={openSheet} style={{ flexShrink: 0, marginLeft: "auto", padding: 0, background: "transparent", border: "none", color: ACCENT, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 5 }}>
        <GridIcon />More
      </button>
    </div>
  );
}

function colLabels(market: string) {
  return marketDef(market).cols.map((t) => (
    <span key={t} style={{ width: 60, textAlign: "center", whiteSpace: "nowrap" }}>{t}</span>
  ));
}

function useOdds(m: TCMatch, market: string, variant: "home" | "live", flashBase: number) {
  const { isOn, pick } = usePicker();
  const def = marketDef(market);
  const values = deriveOdds(m.o, m.ou)[market] ?? [];
  const dirMap: Record<string, string[]> = { "1x2": m.dirs["1x2"], ou: m.dirs.ou, hc: m.dirs["1x2"] };
  return def.cols.map((c, i) => {
    const id = `${m.id}|${market}|${c}`;
    return (
      <OddButton
        key={c}
        variant={variant}
        value={values[i] ?? 0}
        on={isOn(id)}
        dir={variant === "live" ? ((dirMap[market]?.[i] ?? "") as "up" | "down" | "") : ""}
        flash={flashBase + i}
        aria={`${m.home} vs ${m.away} ${def.label} ${c}`}
        onPick={() => pick(m, market, def.label, c, values[i])}
        style={{ flexShrink: 0, width: 60, height: 48, fontSize: 20 }}
      />
    );
  });
}

// ---------- rows ----------
function UpcomingRow({ m, market, onMore }: { m: TCMatch; market: string; onMore: () => void }) {
  const odds = useOdds(m, market, "home", 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: "1px solid #20262E" }}>
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 12, color: "#8B95A1", fontWeight: 600 }}>{kickoff(m.start)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><Crest name={m.home} url={m.homeLogo} size={18} /><span style={{ fontSize: 14, fontWeight: 700, ...ellipsis }}>{m.home}</span></span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><Crest name={m.away} url={m.awayLogo} size={18} /><span style={{ fontSize: 14, fontWeight: 700, ...ellipsis }}>{m.away}</span></span>
        <a href="#" onClick={(e) => { e.preventDefault(); onMore(); }} style={{ fontSize: 12, fontWeight: 700, textDecoration: "none" }}>+{marketCount(m.o, m.ou)} markets</a>
      </div>
      <div style={{ display: "flex", gap: 6 }}>{odds}</div>
    </div>
  );
}

function RedCard({ show }: { show: boolean }) {
  return <span aria-label="Red card" title="Red card" style={{ display: show ? "inline-block" : "none", flexShrink: 0, width: 9, height: 12, borderRadius: 2, background: "#E5484D" }} />;
}

function LiveRow({ m, market, index }: { m: TCMatch; market: string; index: number }) {
  const odds = useOdds(m, market, "live", index * 3);
  const locked = !m.o[0];
  const team = (name: string, logo: string, score: number, red: boolean) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, height: 24, lineHeight: "24px" }}>
      <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <Crest name={name} url={logo} size={16} />
        <span style={{ fontSize: 14, fontWeight: 700, ...ellipsis }}>{name}</span>
        <RedCard show={red} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{score}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: "6px 16px 8px", borderTop: "1px solid #2E3A41" }}>
      <span style={{ paddingLeft: 32, fontSize: 11, lineHeight: "12px", marginBottom: 2, fontWeight: 600, color: "#8B95A1", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
        <Flag country={m.country} size={14} />
        <span style={ellipsis}>{m.country ? `${m.country} · ` : ""}{m.league}</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 48 }}>
        <div style={{ width: 26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-start", height: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: m.clock === "HT" ? "#A9B2BD" : "#E5484D" }}>{m.clock}</span>
        </div>
        <div style={{ flexGrow: 1, minWidth: 0, height: 48, display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
          {team(m.home, m.homeLogo, m.hs, m.red === "home")}
          {team(m.away, m.awayLogo, m.as, m.red === "away")}
        </div>
        <div style={{ display: "flex", gap: 6 }} aria-disabled={locked}>{odds}</div>
      </div>
    </div>
  );
}

function LeagueHeader({ country, name, market, live }: { country: string; name: string; market: string; live?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: live ? "8px 16px 6px" : "16px 16px 8px", background: live ? "#1B2429" : "#171C22" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8B95A1" }}><Flag country={country} />{country}</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{name}</span>
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: "#8B95A1" }}>{colLabels(market)}</div>
    </div>
  );
}

function OddsCol({ m, col, i, pct, top }: { m: TCMatch; col: string; i: number; pct: number; top: boolean }) {
  const { isOn, pick } = usePicker();
  const id = `${m.id}|1x2|${col}`;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: "#8B95A1" }}>{col}</span><span style={{ color: top ? ACCENT : "#C3CBD3" }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "#33414A", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: top ? ACCENT : "#6B7883" }} />
      </div>
      <OddButton variant="home" value={m.o[i]} on={isOn(id)} aria={`${m.home} vs ${m.away} 1X2 ${col}`}
        onPick={() => pick(m, "1x2", "1X2", col, m.o[i])} style={{ height: 44, fontSize: 19, width: "100%" }} />
    </div>
  );
}

export function FeaturedCard({ m, width = 300 }: { m: TCMatch; width?: number | string }) {
  const pct = impliedPct(m.o);
  const top = pct.indexOf(Math.max(...pct));
  const side = (name: string, logo: string) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <Crest name={name} url={logo} size={44} />
      <span style={{ fontSize: 14, fontWeight: 800, ...ellipsis, maxWidth: "100%" }}>{name}</span>
    </div>
  );
  return (
    <article style={{ width, flexShrink: 0, scrollSnapAlign: "start", padding: 16, background: "#1C2229", border: "1px solid #2A323C", borderRadius: 14, display: "flex", flexDirection: "column", gap: 14, boxSizing: "border-box", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 600, color: "#8B95A1" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><Flag country={m.country} size={14} /><span style={ellipsis}>{m.country ? `${m.country} · ` : ""}{m.league}</span></span>
        <span style={{ flexShrink: 0, fontWeight: 800, color: "#C3CBD3" }}>{kickoff(m.start)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {side(m.home, m.homeLogo)}
        <span style={{ paddingTop: 14, fontSize: 12, fontWeight: 700, color: "#5E6A74" }}>VS</span>
        {side(m.away, m.awayLogo)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "#8B95A1" }}>CHANCE IMPLIED BY ODDS</span>
        <div style={{ display: "flex", gap: 6 }}>
          {["1", "X", "2"].map((c, i) => <OddsCol key={c} m={m} col={c} i={i} pct={pct[i]} top={i === top} />)}
        </div>
      </div>
    </article>
  );
}

function PickOfDayCard({ p }: { p: PickOfDay }) {
  const { isOn, pick } = usePicker();
  const m = p.m;
  const id = `${m.id}|${p.marketId}|${p.col}`;
  return (
    <section aria-label="Pick of the day" style={{ width: 300, flexShrink: 0, scrollSnapAlign: "start", boxSizing: "border-box", padding: 16, background: "#1C2229", border: `1px solid ${ACCENT}`, borderRadius: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}><StarIcon />PICK OF THE DAY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Title with small crests: [crest] Home vs [crest] Away */}
        <div aria-label={p.title} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 2, fontSize: 18, fontWeight: 800 }}>
          <Crest name={m.home} url={m.homeLogo} size={22} />
          <span>{m.home}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#5E6A74" }}>vs</span>
          <Crest name={m.away} url={m.awayLogo} size={22} />
          <span>{m.away}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#A9B2BD" }}><Flag country={m.country} size={14} />{p.sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "#222c32", borderRadius: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</div>
        <OddButton variant="home" value={p.odds} on={isOn(id)} aria={p.label} onPick={() => pick(m, p.marketId, p.marketLabel, p.col, p.odds)} style={{ minWidth: 64, height: 44, fontSize: 20 }} />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: "#A9B2BD" }}>{p.note}</div>
    </section>
  );
}

// ---------- screens ----------
export type HomeTab = "upcoming" | "top" | "live";

// Home keeps its top section fixed; the Live / Upcoming / Top leagues tabs only switch the list below.
export function MobileHome({ upcoming, live, loaded, liveLoaded, tab, setTab, openSheet, market, setMarket }: {
  upcoming: TCMatch[]; live: TCMatch[]; loaded: boolean; liveLoaded: boolean; tab: HomeTab; setTab: (t: HomeTab) => void;
  openSheet: () => void; market: string; setMarket: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [dateId, setDateId] = useState("all");
  const [limit, setLimit] = useState(12);
  const listRef = useRef<HTMLDivElement>(null);
  const dates = dateOptions();

  const ranked = useMemo(() => [...upcoming].sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || a.start - b.start), [upcoming]);
  const potd = usePickOfTheDay(upcoming, ranked[0]);
  const featured = ranked.filter((m) => m.id !== potd?.m.id).slice(0, 4);

  const isLive = tab === "live";
  const list = isLive
    ? live
    : upcoming
        .filter((m) => matchesDate(m, dateId))
        .filter((m) => tab === "upcoming" || TOP_LEAGUES.includes(m.league))
        .sort((a, b) => a.start - b.start);
  const leagues = groupByLeague(list.slice(0, limit));
  let liveIndex = 0;

  return (
    <div className="tc-mobile-page">
      <PromoSlider />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 10px" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Featured matches</h2>
        <a href="#" onClick={(e) => { e.preventDefault(); setTab("upcoming"); listRef.current?.scrollIntoView({ behavior: "smooth" }); }} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
          View all<ChevronRight />
        </a>
      </div>
      <div className="tc-hscroll" style={{ display: "flex", alignItems: "stretch", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        {potd ? <PickOfDayCard p={potd} /> : upcoming.length > 0 && (
          <div aria-hidden="true" style={{ width: 300, flexShrink: 0, borderRadius: 14, background: "#1C2229", border: `1px solid ${ACCENT}`, opacity: 0.5 }} />
        )}
        {featured.map((m) => <FeaturedCard key={m.id} m={m} />)}
        {!potd && !loaded && [0, 1].map((i) => <div key={i} style={{ width: 300, height: 250, flexShrink: 0, borderRadius: 14, background: "#1C2229", border: "1px solid #2A323C" }} />)}
      </div>

      <a href="/signup" onClick={(e) => { e.preventDefault(); navigate("/signup"); }} style={{ margin: "12px 16px 0", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#1C2229", border: "1px dashed #3A434E", borderRadius: 12, textDecoration: "none", color: "#F2F4F6" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Welcome bonus up to <strong style={{ color: ACCENT }}>{WELCOME_BONUS_AMOUNT}</strong> on your first deposit</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT, whiteSpace: "nowrap" }}>Claim →</span>
      </a>

      <HotGamesStrip />

      <div ref={listRef} style={{ scrollMarginTop: 72 }}>
        <TopTabs current={tab} liveCount={live.length} onLive={() => { setTab("live"); setLimit(12); }} onUpcoming={() => { setTab("upcoming"); setLimit(12); }} onTop={() => { setTab("top"); setLimit(12); }}
          right={!isLive &&
            <label style={{ position: "relative", flexShrink: 0, whiteSpace: "nowrap", height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid #2E3640", background: "transparent", color: "#F2F4F6", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              {dates.find((d) => d.id === dateId)?.label}
              <ChevronDown />
              <select aria-label="Filter by date" value={dateId} onChange={(e) => { setDateId(e.target.value); setLimit(12); }} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
                {dates.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          }
        />
      </div>
      <MarketTabs market={market} setMarket={setMarket} openSheet={openSheet} />

      {leagues.map((lg) => (
        <section key={lg.name} style={{ display: "flex", flexDirection: "column" }}>
          <LeagueHeader country={lg.country} name={lg.name} market={market} live={isLive} />
          {lg.matches.map((m) => isLive
            ? <LiveRow key={m.id} m={m} market={market} index={liveIndex++} />
            : <UpcomingRow key={m.id} m={m} market={market} onMore={openSheet} />)}
        </section>
      ))}
      {(isLive ? liveLoaded : loaded) && list.length === 0 && (
        <p style={{ padding: "28px 16px", textAlign: "center", fontSize: 14, color: "#8B95A1", margin: 0 }}>
          {isLive ? "No live games right now." : "No matches for this filter."}
        </p>
      )}

      {list.length > limit && (
        <div style={{ padding: 16 }}>
          <button onClick={() => setLimit((l) => l + 12)} style={{ width: "100%", height: 48, borderRadius: 10, border: "1px solid #2E3640", background: "transparent", color: "#F2F4F6", fontSize: 15, fontWeight: 700 }}>Load more matches</button>
        </div>
      )}
    </div>
  );
}

export function StatBar({ label, h, a, big }: { label: string; h: number; a: number; big?: boolean }) {
  const pct = h + a ? Math.round((h / (h + a)) * 100) : 50;
  const suffix = label === "Possession" ? "%" : "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: big ? 5 : 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: big ? 13 : 12, color: "#A9B2BD" }}>
        <span style={big ? { fontWeight: 700, color: "#F2F4F6" } : undefined}>{h}{suffix}</span>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={big ? { fontWeight: 700, color: "#F2F4F6" } : undefined}>{a}{suffix}</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: big ? 5 : 4 }}>
        <span style={{ width: `${pct}%`, borderRadius: big ? 3 : 2, background: ACCENT }} />
        <span style={{ flex: 1, borderRadius: big ? 3 : 2, background: "#4A5663" }} />
      </div>
    </div>
  );
}

export function featuredLive(live: TCMatch[]) {
  // Prefer a game with open markets, then the biggest league.
  return [...live].sort((a, b) => Number(!a.o[0]) - Number(!b.o[0]) || leagueRank(a.league) - leagueRank(b.league))[0];
}

export function MobileLive({ live, loaded, onUpcoming, onTop, openSheet, market, setMarket }: {
  live: TCMatch[]; loaded: boolean; onUpcoming: () => void; onTop: () => void; openSheet: () => void; market: string; setMarket: (id: string) => void;
}) {
  const { isOn, pick } = usePicker();
  const f = featuredLive(live);
  const rest = live.filter((m) => m !== f);
  const leagues = groupByLeague(rest);
  let rowIndex = 0;

  return (
    <div className="tc-mobile-page">
      <TopTabs current="live" liveCount={live.length} onLive={() => {}} onUpcoming={onUpcoming} onTop={onTop} liveTall />

      <div aria-label="Filter by sport" className="tc-hscroll" style={{ display: "flex", gap: 8, padding: "12px 16px", overflowX: "auto" }}>
        <button style={{ height: 36, padding: "0 14px", borderRadius: 18, border: "none", background: "#F2F4F6", color: "#13171C", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>Football · {live.length}</button>
      </div>

      {f && (
        <section aria-label="Featured live match" style={{ margin: "4px 16px 0", padding: 16, background: "#1C2229", border: "1px solid #2A323C", borderRadius: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#8B95A1" }}><Flag country={f.country} size={14} />{f.country ? `${f.country} · ` : ""}{f.league}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: f.clock === "HT" ? "#A9B2BD" : "#E5484D" }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: "#E5484D" }} />{f.clock}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {[f.home, null, f.away].map((name, i) => name === null ? (
              <div key="score" style={{ fontFamily: barlow, fontSize: 44, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>{f.hs} – {f.as}</div>
            ) : (
              <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
                <Crest name={name} url={i === 0 ? f.homeLogo : f.awayLogo} size={40} fontSize={13} />
                <span style={{ fontSize: 14, fontWeight: 700, ...ellipsis, maxWidth: "100%" }}>{name}</span>
              </div>
            ))}
          </div>
          {f.stats && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <StatBar label="Possession" h={f.stats.possession[0]} a={f.stats.possession[1]} />
              <StatBar label="Shots" h={f.stats.shots[0]} a={f.stats.shots[1]} />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div aria-hidden="true" style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: "#8B95A1" }}>
              {["1", "X", "2"].map((c) => <span key={c} style={{ flex: 1, textAlign: "center" }}>{c}</span>)}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {["1", "X", "2"].map((c, i) => (
                <OddButton key={c} variant="live" value={f.o[i]} on={isOn(`${f.id}|1x2|${c}`)} dir={f.dirs["1x2"][i]} flash={i}
                  aria={`${f.home} vs ${f.away} 1X2 ${c}`} onPick={() => pick(f, "1x2", "1X2", c, f.o[i])}
                  style={{ flex: 1, minWidth: 0, height: 52, padding: "0 12px", fontSize: 20 }} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #3A434E", background: "transparent", color: "#F2F4F6", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <TrackerIcon />Match tracker
            </button>
            <button onClick={openSheet} style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #3A434E", background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 700 }}>+{marketCount(f.o, f.ou)} live markets</button>
          </div>
        </section>
      )}

      <MarketTabs market={market} setMarket={setMarket} openSheet={openSheet} />

      {leagues.map((lg) => (
        <section key={lg.name} style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
          <LeagueHeader country={lg.country} name={lg.name} market={market} live />
          {lg.matches.map((m) => <LiveRow key={m.id} m={m} market={market} index={rowIndex++} />)}
        </section>
      ))}
      {loaded && live.length === 0 && (
        <p style={{ padding: "28px 16px", textAlign: "center", fontSize: 14, color: "#8B95A1", margin: 0 }}>No live games right now.</p>
      )}
    </div>
  );
}

