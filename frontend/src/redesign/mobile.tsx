import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { zoned } from "../lib/browser";
import { CAN_SWITCH_THEME, THEME_BADGE, THEME_NAMES, useTheme } from "../context/ThemeContext";
import {
  type TCMatch, TOP_LEAGUES, dateOptions, dayHeading, dayLabel, groupByLeague, hhmm, kickoff, leagueRank, leagueSlug, matchesDate,
} from "./data";
import {
  ChevronDown, ChevronLeft, ChevronRight, GridIcon, HeadsetIcon, HomeIcon, MoreIcon, LiveIcon, MoonIcon, ReceiptIcon, StarIcon, TicketShape, TrackerIcon, UserIcon,
} from "./icons";
import { FIXED, deriveOdds, impliedPct, marketCount, marketDef } from "./markets";
import { NUM_FONT, ON_ACCENT, ACCENT_TEXT, ACCENT, Loader, useMinLoading, useThemeButton, DemoTag, OddButton, SHOW_TAB_FEATURE, WELCOME_BONUS_AMOUNT, usePicker } from "./shared";
import { Crest, Flag, HotGamesStrip, PromoSlider } from "./media";
import { SiteFooter, WinnersStrip } from "./footer";
import { type PickOfDay, featuredUpcoming, usePickOfTheDay } from "./potd";
import { ThemedHero, useLayout } from "./themed";

const barlow = NUM_FONT;
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

// ---------- header ----------
export function MobileHeader({ simulated }: { simulated: boolean }) {
  const { isAuthenticated, balance, logout } = useAuth();
  const themeBtn = useThemeButton();
  const { theme } = useTheme();
  const navigate = useNavigate();
  // Publish the header height (--tc-header-h) so sticky rows can sit right under it.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--tc-header-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <header ref={ref} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--tc-line)", position: "sticky", top: 0, zIndex: 30, background: "var(--tc-header)" }}>
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--tc-text)" }}>
        <span style={{ fontFamily: barlow, fontStyle: "italic", fontWeight: 700, fontSize: 32, letterSpacing: -0.5, lineHeight: 1 }}>
          Pocca<span style={{ color: ACCENT_TEXT }}>bet</span>
        </span>
        {simulated && <DemoTag />}
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {CAN_SWITCH_THEME && <button aria-label={`Switch theme (now ${THEME_NAMES[theme]})`} {...themeBtn} style={{ position: "relative", width: 44, height: 44, borderRadius: 22, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MoonIcon />
          {/* Current theme letter */}
          <span aria-hidden="true" style={{ position: "absolute", right: -3, bottom: -3, minWidth: 16, height: 16, padding: "0 3px", borderRadius: 8, background: ACCENT, color: ON_ACCENT, fontSize: 10, fontWeight: 800, lineHeight: "16px", textAlign: "center" }}>{THEME_BADGE[theme]}</span>
        </button>}
        {isAuthenticated ? (
          <>
            <span style={{ height: 44, padding: "0 12px", borderRadius: 10, border: "1px solid var(--tc-outline-2)", color: "var(--tc-text)", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center" }}>₦{balance.toFixed(2)}</span>
            <button onClick={logout} style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "none", background: ACCENT, color: ON_ACCENT, fontWeight: 800, fontSize: 15 }}>Log out</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate("/signup")} style={{ height: 44, padding: "0 16px", borderRadius: 10, border: "1px solid var(--tc-outline-2)", background: "transparent", color: "var(--tc-text)", fontWeight: 700, fontSize: 15 }}>Join</button>
            <button onClick={() => navigate("/login")} style={{ height: 44, padding: "0 18px", borderRadius: 10, border: "none", background: ACCENT, color: ON_ACCENT, fontWeight: 800, fontSize: 15 }}>Login</button>
          </>
        )}
      </div>
    </header>
  );
}

// ---------- sections nav (Sports / Aviator / Virtuals / Jackpot / Casino) ----------
// Theme A's quick-nav items and icon artwork. Single-colour glyphs are recoloured to Theme C
// through a CSS mask (yellow when active, grey otherwise); Casino and Specials keep their
// original colours, as in Theme A. Support and More use line icons (no artwork yet).
export type SectionKey = "sports" | "live" | "today" | "support" | "more";
const SECTIONS: { key: string; label: string; icon?: string; Svg?: typeof MoreIcon; original: boolean }[] = [
  { key: "sports", label: "Sports", icon: "/icons/soccer-ball.png", original: false },
  { key: "live", label: "Live", icon: "/icons/live-3.png", original: false },
  { key: "aviator", label: "Aviator", icon: "/icons/aviator.png", original: false },
  { key: "virtuals", label: "Virtuals", icon: "/icons/visuals.png", original: false },
  { key: "today", label: "Today", icon: "/icons/today.png", original: false },
  { key: "jackpot", label: "Jackpot", icon: "/icons/jackpot.png", original: false },
  { key: "casino", label: "Casino", icon: "/icons/casino.png", original: true },
  { key: "specials", label: "Specials", icon: "/icons/Specials.png", original: true },
  { key: "support", label: "Support", Svg: HeadsetIcon, original: false },
  { key: "more", label: "More", Svg: MoreIcon, original: false },
];

function NavIcon({ src, original }: { src: string; original: boolean }) {
  if (original) {
    return <img src={src} alt="" width={26} height={26} style={{ width: 26, height: 26, objectFit: "contain" }} />;
  }
  return (
    <span aria-hidden="true" style={{
      width: 26, height: 26, display: "block", background: "currentColor",
      WebkitMask: `url(${src}) center / contain no-repeat`, mask: `url(${src}) center / contain no-repeat`,
    }} />
  );
}
export function SectionsNav({ active, onSelect }: { active: SectionKey; onSelect: (key: SectionKey) => void }) {
  return (
    <nav aria-label="Sections" className="tc-hscroll" style={{ display: "flex", gap: 2, padding: "8px 8px 0", borderBottom: "1px solid var(--tc-divider)", overflowX: "auto" }}>
      {SECTIONS.map(({ key, label, icon, Svg, original }) => {
        const on = key === active;
        const action = ["sports", "live", "today", "support", "more"].includes(key) ? (key as SectionKey) : null;
        return (
          <button key={key} aria-current={on ? "page" : undefined} onClick={action ? () => onSelect(action) : undefined} style={{
            flex: "0 0 auto", minWidth: 64, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 6px 10px",
            background: "transparent", border: "none", borderBottom: `2px solid ${on ? ACCENT : "transparent"}`,
            color: on ? ACCENT : "var(--tc-muted)", fontSize: 12, fontWeight: on ? 700 : 600,
          }}>
            {Svg ? <Svg size={26} /> : icon && <NavIcon src={icon} original={original} />}
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
        gap: 4, textDecoration: "none", color: on ? ACCENT : "var(--tc-muted)", fontSize: 11, fontWeight: on ? 800 : 600,
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
      // No extra bottom padding on purpose, but keep env(safe-area-inset-bottom): it adds the
      // home-bar space on phones when the site runs edge to edge (e.g. installed as an app).
      padding: "0 4px env(safe-area-inset-bottom)", background: "var(--tc-panel)", borderTop: "1px solid var(--tc-line)", boxShadow: "0 -8px 24px rgba(0,0,0,0.35)",
    }}>
      {item("home", "Home", <HomeIcon />, onHome)}
      {item("live", "Live", <>
        <LiveIcon />
        {liveCount > 0 && <span style={{ position: "absolute", top: -4, right: -12, padding: "0 5px", height: 16, borderRadius: 8, background: "#E5484D", color: "#FFFFFF", fontSize: 10, fontWeight: 800, lineHeight: "16px" }}>{liveCount}</span>}
      </>, onLive)}
      <a href="#" aria-label={`Betslip, ${count} selections`} onClick={(e) => { e.preventDefault(); onSlip(); }} style={{
        flex: 1, height: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4,
        paddingBottom: 8, boxSizing: "border-box", textDecoration: "none", color: "var(--tc-text)", fontSize: 11, fontWeight: 800,
      }}>
        <span style={{ position: "relative", width: 68, height: 46, marginTop: -26, filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.45))" }}>
          <TicketShape accent={ACCENT} />
          <span style={{ position: "absolute", left: 20, right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontSize: 26, fontWeight: 700, color: ON_ACCENT }}>{count}</span>
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
    color: on ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 15, fontWeight: on ? 800 : 700, whiteSpace: "nowrap", flexShrink: 0,
  });
  return (
    <div className="tc-hscroll" style={{ padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, overflowX: "auto", borderBottom: `1px solid ${liveTall ? "var(--tc-line)" : "var(--tc-divider)"}` }}>
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
            color: on ? "var(--tc-text)" : "var(--tc-label)", fontSize: 13, fontWeight: on ? 800 : 600,
          }}>{marketDef(id).label}</button>
        );
      })}
      <button aria-haspopup="dialog" onClick={openSheet} style={{ flexShrink: 0, marginLeft: "auto", padding: 0, background: "transparent", border: "none", color: ACCENT_TEXT, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 5 }}>
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
        dir={(dirMap[market]?.[i] ?? "") as "up" | "down" | ""}
        flash={flashBase + i}
        aria={`${m.home} vs ${m.away} ${def.label} ${c}`}
        onPick={() => pick(m, market, def.label, c, values[i])}
        style={{ flexShrink: 0, width: 60, height: 48, fontSize: 20 }}
      />
    );
  });
}

// ---------- rows ----------
function UpcomingRow({ m, market, onMore, timeOnly }: { m: TCMatch; market: string; onMore: () => void; timeOnly?: boolean }) {
  const odds = useOdds(m, market, "home", 0);
  return (
    <div className="tc-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--tc-line)" }}>
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 12, color: "var(--tc-label)", fontWeight: 600 }}>{timeOnly ? hhmm(m.start) : kickoff(m.start)}</span>
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
      <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT_TEXT }}>{score}</span>
    </div>
  );
  return (
    <div className="tc-row" style={{ display: "flex", flexDirection: "column", gap: 0, padding: "8px 16px", borderTop: "1px solid var(--tc-line)" }}>
      {/* League/country is already in the section header above — not repeated per match. */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, height: 48 }}>
        <div style={{ width: 26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-start", height: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: m.clock === "HT" ? "var(--tc-muted)" : "#E5484D" }}>{m.clock}</span>
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

// Theme A: darker headers (var(--tc-league)) so each league reads as a block.
// Theme B: lighter, compact headers (var(--tc-panel)) — the original Live-tab look.
function LeagueHeader({ country, name, market }: { country: string; name: string; market: string }) {
  const light = useTheme().theme === "c";
  return (
    <div className="tc-league-head" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: light ? "8px 16px 6px" : "12px 16px 8px", background: "var(--tc-league)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--tc-label)" }}><Flag country={country} />{country}</span>
        <span className="tc-league-name" style={{ fontSize: 15, fontWeight: 800 }}>{name}</span>
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>{colLabels(market)}</div>
    </div>
  );
}

function OddsCol({ m, col, i, pct, top }: { m: TCMatch; col: string; i: number; pct: number; top: boolean }) {
  const { isOn, pick } = usePicker();
  const id = `${m.id}|1x2|${col}`;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
        <span style={{ color: "var(--tc-label)" }}>{col}</span><span style={{ color: top ? ACCENT : "var(--tc-soft)" }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--tc-track)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: top ? ACCENT : "var(--tc-bar-mid)" }} />
      </div>
      <OddButton variant="home" value={m.o[i]} on={isOn(id)} dir={m.dirs["1x2"][i]} aria={`${m.home} vs ${m.away} 1X2 ${col}`}
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
    <article style={{ width, flexShrink: 0, scrollSnapAlign: "start", padding: 16, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, display: "flex", flexDirection: "column", gap: 14, boxSizing: "border-box", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--tc-label)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><Flag country={m.country} size={14} /><span style={ellipsis}>{m.country ? `${m.country} · ` : ""}{m.league}</span></span>
        <span style={{ flexShrink: 0, fontWeight: 800, color: "var(--tc-soft)" }}>{kickoff(m.start)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        {side(m.home, m.homeLogo)}
        <span style={{ paddingTop: 14, fontSize: 12, fontWeight: 700, color: "var(--tc-faint)" }}>VS</span>
        {side(m.away, m.awayLogo)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: 1, color: "var(--tc-label)" }}>CHANCE IMPLIED BY ODDS</span>
        <div style={{ display: "flex", gap: 6 }}>
          {["1", "X", "2"].map((c, i) => <OddsCol key={c} m={m} col={c} i={i} pct={pct[i]} top={i === top} />)}
        </div>
      </div>
    </article>
  );
}

// Crest + team name that always stay together; names wider than the card get "…".
function TeamUnit({ name, logo }: { name: string; logo: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", minWidth: 0, whiteSpace: "nowrap" }}>
      <Crest name={name} url={logo} size={22} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
    </span>
  );
}

function PickOfDayCard({ p }: { p: PickOfDay }) {
  const { isOn, pick } = usePicker();
  const m = p.m;
  const id = `${m.id}|${p.marketId}|${p.col}`;
  return (
    <section aria-label="Pick of the day" style={{ width: 300, flexShrink: 0, scrollSnapAlign: "start", boxSizing: "border-box", padding: 16, background: "var(--tc-card)", border: `1px solid ${ACCENT}`, borderRadius: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: ACCENT_TEXT, fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}><StarIcon />PICK OF THE DAY</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Title with small crests: [crest] Home vs [crest] Away */}
        {/* Each team is one unbreakable unit (crest + name), so a long title can only wrap
            between the teams — a crest never gets separated from its name. */}
        <div aria-label={p.title} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 6, rowGap: 2, fontSize: 18, fontWeight: 800, minWidth: 0 }}>
          <TeamUnit name={m.home} logo={m.homeLogo} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tc-faint)" }}>vs</span>
          <TeamUnit name={m.away} logo={m.awayLogo} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--tc-muted)" }}><Flag country={m.country} size={14} />{p.sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "var(--tc-page)", borderRadius: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{p.label}</div>
        <OddButton variant="home" value={p.odds} on={isOn(id)} aria={p.label} onPick={() => pick(m, p.marketId, p.marketLabel, p.col, p.odds)} style={{ minWidth: 64, height: 44, fontSize: 20 }} />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--tc-muted)" }}>{p.note}</div>
    </section>
  );
}

// ---------- screens ----------
export type HomeTab = "upcoming" | "top" | "live";

// Home keeps its top section fixed; the Live / Upcoming / Top leagues tabs only switch the list below.
export function MobileHome({ upcoming, live, loaded, liveLoaded, tab, setTab, dateId, setDateId, openSheet, onOpenMatch, market, setMarket }: {
  upcoming: TCMatch[]; live: TCMatch[]; loaded: boolean; liveLoaded: boolean; tab: HomeTab; setTab: (t: HomeTab) => void;
  dateId: string; setDateId: (id: string) => void; openSheet: () => void; onOpenMatch: (m: TCMatch) => void;
  market: string; setMarket: (id: string) => void;
}) {
  const navigate = useNavigate();
  const layout = useLayout();
  const [limit, setLimit] = useState(12);
  const listRef = useRef<HTMLDivElement>(null);
  // Publish the tabs-row height (--tc-tabs-h) so the market tabs can stick right under it.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--tc-tabs-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const dates = dateOptions();

  const ranked = useMemo(() => [...upcoming].sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || a.start - b.start), [upcoming]);
  const potd = usePickOfTheDay(upcoming, ranked[0]);
  const featured = ranked.filter((m) => m.id !== potd?.m.id).slice(0, 4);

  const isLive = tab === "live";
  const tabList = isLive
    ? live
    : upcoming
        .filter((m) => matchesDate(m, dateId))
        .filter((m) => tab === "upcoming" || TOP_LEAGUES.includes(m.league))
        .sort((a, b) => a.start - b.start);
  // Every tab leads with a featured match (one switch turns them all off).
  const featuredMatch = !SHOW_TAB_FEATURE ? undefined : isLive ? featuredLive(live) : featuredUpcoming(tabList, potd?.m.id);
  const list = tabList.filter((m) => m !== featuredMatch);
  const leagues = groupByLeague(list.slice(0, limit));
  const listLoading = useMinLoading(!(isLive ? liveLoaded : loaded) && list.length === 0);
  let liveIndex = 0;

  return (
    <div className="tc-mobile-page">
      {layout !== "classic" ? (
        <ThemedHero potd={potd} live={live} upcoming={ranked} loaded={loaded} onOpenMatch={onOpenMatch}
          onLive={() => { setTab("live"); setLimit(12); requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth" })); }} />
      ) : <>
      <PromoSlider />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 10px" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Featured matches</h2>
        <a href="#" onClick={(e) => { e.preventDefault(); setTab("upcoming"); listRef.current?.scrollIntoView({ behavior: "smooth" }); }} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
          View all<ChevronRight />
        </a>
      </div>
      <div className="tc-hscroll" style={{ display: "flex", alignItems: "stretch", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        {potd ? <PickOfDayCard p={potd} /> : upcoming.length > 0 && (
          <div aria-hidden="true" style={{ width: 300, flexShrink: 0, borderRadius: 14, background: "var(--tc-card)", border: `1px solid ${ACCENT}`, opacity: 0.5 }} />
        )}
        {featured.map((m) => <FeaturedCard key={m.id} m={m} />)}
        {!potd && !loaded && [0, 1].map((i) => <div key={i} style={{ width: 300, height: 250, flexShrink: 0, borderRadius: 14, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)" }} />)}
      </div>

      <a href="/signup" onClick={(e) => { e.preventDefault(); navigate("/signup"); }} style={{ margin: "12px 16px 0", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--tc-card)", border: "1px dashed var(--tc-outline-2)", borderRadius: 12, textDecoration: "none", color: "var(--tc-text)" }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Welcome bonus up to <strong style={{ color: ACCENT_TEXT }}>{WELCOME_BONUS_AMOUNT}</strong> on your first deposit</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT_TEXT, whiteSpace: "nowrap" }}>Claim →</span>
      </a>
      </>}

      <QuickLinks upcoming={upcoming} live={live} />

      <HotGamesStrip />

      {/* Live / Upcoming / Top leagues row sticks right under the header while scrolling the list. */}
      <div ref={listRef} id="tc-list" style={{ marginTop: 20, position: "sticky", top: "var(--tc-header-h, 69px)", zIndex: 20, background: "var(--tc-page)", scrollMarginTop: "var(--tc-header-h, 69px)" }}>
        <TopTabs current={tab} liveCount={live.length} onLive={() => { setTab("live"); setLimit(12); }} onUpcoming={() => { setTab("upcoming"); setLimit(12); }} onTop={() => { setTab("top"); setLimit(12); }}
          right={!isLive &&
            <label style={{ position: "relative", flexShrink: 0, whiteSpace: "nowrap", height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              {dates.find((d) => d.id === dateId)?.label}
              <ChevronDown />
              <select suppressHydrationWarning aria-label="Filter by date" value={dateId} onChange={(e) => { setDateId(e.target.value); setLimit(12); }} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", fontSize: 16 }}>
                {dates.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          }
        />
      </div>
      {featuredMatch && <div style={{ paddingTop: 12 }}><FeaturedMatchCard f={featuredMatch} onOpenMatch={onOpenMatch} /></div>}
      {/* Market tabs stick right under the Live / Upcoming / Top leagues row. */}
      <div style={{ position: "sticky", top: "calc(var(--tc-header-h, 69px) + var(--tc-tabs-h, 45px))", zIndex: 19, background: "var(--tc-page)", borderBottom: "1px solid var(--tc-divider)" }}>
        <MarketTabs market={market} setMarket={setMarket} openSheet={openSheet} />
      </div>

      {!listLoading && leagues.map((lg) => (
        <section className="tc-league-sec" key={lg.key} style={{ display: "flex", flexDirection: "column" }}>
          <LeagueHeader country={lg.country} name={lg.name} market={market} />
          {lg.matches.map((m) => isLive
            ? <LiveRow key={m.id} m={m} market={market} index={liveIndex++} />
            : <UpcomingRow key={m.id} m={m} market={market} onMore={() => onOpenMatch(m)} />)}
        </section>
      ))}
      {listLoading && <Loader label={isLive ? "Loading live games…" : "Loading matches…"} />}
      {!listLoading && (isLive ? liveLoaded : loaded) && list.length === 0 && (
        <p style={{ padding: "28px 16px", textAlign: "center", fontSize: 14, color: "var(--tc-label)", margin: 0 }}>
          {isLive ? "No live games right now." : "No matches for this filter."}
        </p>
      )}

      {list.length > limit && (
        <div style={{ padding: 16 }}>
          <button onClick={() => setLimit((l) => l + 12)} style={{ width: "100%", height: 48, borderRadius: 10, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", fontSize: 15, fontWeight: 700 }}>Load more matches</button>
        </div>
      )}

      <WinnersStrip />
      <SiteFooter />
    </div>
  );
}

// ---------- quick links + league pages ----------
// Quick links open a league's own page (/league/<country-name>), so it can be shared and
// the phone's back button returns home.
export const QUICK_LINKS = [
  { country: "England", name: "Premier League" },
  { country: "Spain", name: "La Liga" },
  { country: "Italy", name: "Serie A" },
  { country: "Nigeria", name: "NPFL" },
];

function QuickLinks({ upcoming, live }: { upcoming: TCMatch[]; live: TCMatch[] }) {
  const navigate = useNavigate();
  const count = (list: TCMatch[], q: { country: string; name: string }) =>
    list.filter((m) => m.country === q.country && m.league === q.name).length;
  return (
    <section aria-label="Quick links" style={{ padding: "22px 16px 0" }}>
      <h2 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 800 }}>Quick links</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {QUICK_LINKS.map((q) => {
          const href = `/league/${leagueSlug(q.country, q.name)}`;
          const nLive = count(live, q);
          const total = count(upcoming, q) + nLive;
          return (
            <a key={href} href={href} onClick={(e) => { e.preventDefault(); navigate(href); }} style={{
              minHeight: 56, padding: "10px 12px", borderRadius: 12, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)",
              display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--tc-text)",
            }}>
              <Flag country={q.country} size={20} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{q.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: nLive ? "#E5484D" : "var(--tc-label)" }}>
                  {nLive ? `${nLive} live` : `${total} match${total === 1 ? "" : "es"}`}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// A section heading inside the league page: "LIVE NOW" / "Today" / "Saturday 26 Sep", with the market's column labels.
function GroupHeader({ title, live, market }: { title: string; live?: boolean; market: string }) {
  return (
    <div className="tc-league-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 8px", background: "var(--tc-league)" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: live ? "#E5484D" : "var(--tc-text)" }}>
        {live && <span style={{ width: 7, height: 7, borderRadius: 4, background: "#E5484D" }} />}{title}
      </span>
      <div style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>{colLabels(market)}</div>
    </div>
  );
}

// Back returns to where you came from; opened from a shared link, it goes home.
export function useBack() {
  const navigate = useNavigate();
  return () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/"));
}

// Sticky title bar for inner pages: back arrow, optional flag, title and a small line under it.
export function PageHeader({ title, sub, country }: { title: string; sub?: string; country?: string }) {
  const back = useBack();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 8px 4px", borderBottom: "1px solid var(--tc-divider)" }}>
      <button aria-label="Back" onClick={back} style={{ width: 44, height: 44, flexShrink: 0, border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ChevronLeft size={20} />
      </button>
      {country && <Flag country={country} size={24} />}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, ...ellipsis }}>{title}</h1>
        {sub && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tc-label)" }}>{sub}</span>}
      </div>
    </div>
  );
}

const plural = (n: number) => `${n} match${n === 1 ? "" : "es"}`;

// A full page of matches (league page, "Today's games", "Live", a date…).
// group "day": one league — live first, then a heading per day, rows show just the time.
// group "league": many leagues — a league header per league, like the home list.
export function MatchListPage({ title, sub, country, liveList, upList, loaded, group, resetKey, market, setMarket, openSheet, onOpenMatch }: {
  title: string; sub?: string; country?: string; liveList: TCMatch[]; upList: TCMatch[]; loaded: boolean; group: "day" | "league";
  resetKey: string; market: string; setMarket: (id: string) => void; openSheet: () => void; onOpenMatch: (m: TCMatch) => void;
}) {
  const navigate = useNavigate();
  const [limit, setLimit] = useState(20);
  useEffect(() => { window.scrollTo(0, 0); setLimit(20); }, [resetKey]);

  const ups = [...upList].sort((a, b) => a.start - b.start);
  const total = liveList.length + ups.length;
  const busy = useMinLoading(!loaded && total === 0);
  const shown = ups.slice(0, limit);
  const days: { key: string; title: string; matches: TCMatch[] }[] = [];
  if (group === "day") {
    for (const m of shown) {
      const key = zoned(m.start).toDateString();
      const last = days[days.length - 1];
      if (last?.key === key) last.matches.push(m);
      else days.push({ key, title: dayHeading(m.start), matches: [m] });
    }
  }

  return (
    <div className="tc-mobile-page">
      <div style={{ position: "sticky", top: "var(--tc-header-h, 69px)", zIndex: 20, background: "var(--tc-page)" }}>
        <PageHeader title={title} country={country} sub={[sub, loaded ? plural(total) : ""].filter(Boolean).join(" · ")} />
        <div style={{ borderBottom: "1px solid var(--tc-divider)" }}>
          <MarketTabs market={market} setMarket={setMarket} openSheet={openSheet} />
        </div>
      </div>

      {busy ? <Loader label="Loading matches…" /> : <>
      {liveList.length > 0 && (group === "day" ? (
        <section className="tc-league-sec">
          <GroupHeader title="Live now" live market={market} />
          {liveList.map((m, i) => <LiveRow key={m.id} m={m} market={market} index={i} />)}
        </section>
      ) : groupByLeague(liveList).map((lg) => (
        <section className="tc-league-sec" key={`live-${lg.key}`}>
          <LeagueHeader country={lg.country} name={lg.name} market={market} />
          {lg.matches.map((m, i) => <LiveRow key={m.id} m={m} market={market} index={i} />)}
        </section>
      )))}
      {group === "day" ? days.map((d) => (
        <section className="tc-league-sec" key={d.key}>
          <GroupHeader title={d.title} market={market} />
          {d.matches.map((m) => <UpcomingRow key={m.id} m={m} market={market} onMore={() => onOpenMatch(m)} timeOnly />)}
        </section>
      )) : groupByLeague(shown).map((lg) => (
        <section className="tc-league-sec" key={lg.key}>
          <LeagueHeader country={lg.country} name={lg.name} market={market} />
          {lg.matches.map((m) => <UpcomingRow key={m.id} m={m} market={market} onMore={() => onOpenMatch(m)} />)}
        </section>
      ))}

      {loaded && total === 0 && (
        <div style={{ padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--tc-label)", textAlign: "center" }}>No matches here right now. Check back soon.</p>
          <button onClick={() => navigate("/")} style={{ height: 44, padding: "0 20px", borderRadius: 10, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", fontSize: 14, fontWeight: 700 }}>Back to home</button>
        </div>
      )}
      {ups.length > limit && (
        <div style={{ padding: 16 }}>
          <button onClick={() => setLimit((l) => l + 20)} style={{ width: "100%", height: 48, borderRadius: 10, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", fontSize: 15, fontWeight: 700 }}>Load more matches</button>
        </div>
      )}
      </>}

      <SiteFooter />
    </div>
  );
}

// Props every match-list layout takes (mobile MatchListPage, desktop DesktopListPage).
export type ListViewProps = Parameters<typeof MatchListPage>[0];

export function StatBar({ label, h, a, big }: { label: string; h: number; a: number; big?: boolean }) {
  const pct = h + a ? Math.round((h / (h + a)) * 100) : 50;
  const suffix = label === "Possession" ? "%" : "";
  // The side that's ahead gets the yellow bar and a bold white number; level = both grey.
  const lead = h > a ? "home" : a > h ? "away" : null;
  const bar = (side: "home" | "away") => (lead === side ? ACCENT : lead ? "var(--tc-bar-low)" : "var(--tc-bar-mid)");
  const num = (side: "home" | "away") => ({ fontWeight: lead === side ? 800 : 700, color: lead === side ? "var(--tc-text)" : "var(--tc-muted)" });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: big ? 5 : 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: big ? 13 : 12, color: "var(--tc-muted)" }}>
        <span style={num("home")}>{h}{suffix}</span>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={num("away")}>{a}{suffix}</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: big ? 5 : 4 }}>
        <span style={{ width: `${pct}%`, borderRadius: big ? 3 : 2, background: bar("home") }} />
        <span style={{ flex: 1, borderRadius: big ? 3 : 2, background: bar("away") }} />
      </div>
    </div>
  );
}

export function featuredLive(live: TCMatch[]) {
  // Prefer a game with open markets, then the biggest league.
  return [...live].sort((a, b) => Number(!a.o[0]) - Number(!b.o[0]) || leagueRank(a.league) - leagueRank(b.league))[0];
}

// Featured match at the top of each list tab. Live: score, minute, possession and shots.
// Upcoming: kickoff time and the chance implied by the odds.
export function ChanceBar({ m, big }: { m: TCMatch; big?: boolean }) {
  const pct = impliedPct(m.o);
  // The most likely outcome gets the yellow bar; its percentage is bold white (yellow stays for actions).
  const top = pct.indexOf(Math.max(...pct));
  const bar = (i: number) => (i === top ? ACCENT : i === 1 ? "var(--tc-bar-mid)" : "var(--tc-bar-low)");
  const text = (i: number) => (i === top ? "var(--tc-text)" : "var(--tc-muted)");
  const weight = (i: number) => (i === top ? 800 : 700);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: big ? 6 : 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: big ? 13 : 12, color: "var(--tc-muted)" }}>
        <span style={{ fontWeight: weight(0), color: text(0) }}>{pct[0]}%</span>
        <span style={{ fontWeight: 700 }}>Chance implied by odds</span>
        <span style={{ fontWeight: weight(2), color: text(2) }}>{pct[2]}%</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: big ? 5 : 4 }}>
        {pct.map((p, i) => <span key={i} style={{ width: `${p}%`, borderRadius: 3, background: bar(i) }} />)}
      </div>
      <div style={{ textAlign: "center", fontSize: 11, fontWeight: weight(1), color: top === 1 ? "var(--tc-text)" : "var(--tc-label)" }}>Draw {pct[1]}%</div>
    </div>
  );
}

function FeaturedMatchCard({ f, onOpenMatch }: { f: TCMatch; onOpenMatch: (m: TCMatch) => void }) {
  const { isOn, pick } = usePicker();
  return (
    <section aria-label={f.live ? "Featured live match" : "Featured match"} style={{ margin: "4px 16px 0", padding: 16, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}><Flag country={f.country} size={14} />{f.country ? `${f.country} · ` : ""}{f.league}</span>
        {f.live ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: f.clock === "HT" ? "var(--tc-muted)" : "#E5484D" }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: "#E5484D" }} />{f.clock}
          </span>
        ) : (
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--tc-soft)" }}>{dayLabel(f.start)}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {[f.home, null, f.away].map((name, i) => name === null ? (
          <div key="mid" style={{ fontFamily: barlow, fontSize: 44, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>
            {f.live ? `${f.hs} – ${f.as}` : hhmm(f.start)}
          </div>
        ) : (
          <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
            <Crest name={name} url={i === 0 ? f.homeLogo : f.awayLogo} size={40} fontSize={13} />
            <span style={{ fontSize: 14, fontWeight: 700, ...ellipsis, maxWidth: "100%" }}>{name}</span>
          </div>
        ))}
      </div>
      {f.live ? f.stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <StatBar label="Possession" h={f.stats.possession[0]} a={f.stats.possession[1]} />
          <StatBar label="Shots" h={f.stats.shots[0]} a={f.stats.shots[1]} />
        </div>
      ) : <ChanceBar m={f} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div aria-hidden="true" style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
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
        <button style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid var(--tc-outline-2)", background: "transparent", color: "var(--tc-text)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <TrackerIcon />{f.live ? "Match tracker" : "Match preview"}
        </button>
        <button onClick={() => onOpenMatch(f)} style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid var(--tc-outline-2)", background: "transparent", color: ACCENT_TEXT, fontSize: 14, fontWeight: 700 }}>
          +{marketCount(f.o, f.ou)} {f.live ? "live markets" : "markets"}
        </button>
      </div>
    </section>
  );
}

