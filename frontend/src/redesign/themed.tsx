// Theme Daylight's own phone layout: header, sections row, home top section and bottom nav.
// Everything else (lists, slip, account…) is shared and takes the theme's colours and fonts
// from redesign.css.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CAN_SWITCH_THEME, LIGHT_THEMES, THEME_BADGE, THEME_NAMES, useTheme } from "../context/ThemeContext";
import { type TCMatch, hhmm, kickoff } from "./data";
import { HomeIcon, LiveIcon, MoonIcon, ReceiptIcon, StarIcon, UserIcon } from "./icons";
import { Crest, Flag } from "./media";
import type { SectionKey } from "./mobile";
import type { PickOfDay } from "./potd";
import { ACCENT, NUM_FONT, OddButton, WELCOME_BONUS_AMOUNT, useThemeButton, usePicker } from "./shared";

export type Layout = "classic" | "daylight";
export function useLayout(): Layout {
  const { theme } = useTheme();
  return LIGHT_THEMES.includes(theme) ? (theme as Layout) : "classic";
}

const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const NAVY = "var(--day-navy)";

// ---------- logo ----------
export function Logo({ size = 32 }: { size?: number }) {
  if (useLayout() === "daylight") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden="true" style={{ width: size * 0.8, height: size * 0.8, borderRadius: size * 0.28, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: size * 0.3, height: size * 0.3, borderRadius: size, background: "#FFFFFF" }} />
        </span>
        <span style={{ fontFamily: "var(--tc-display)", fontWeight: 800, fontSize: size * 0.66, letterSpacing: -0.6, lineHeight: 1 }}>Poccabet</span>
      </span>
    );
  }
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: size, letterSpacing: -0.5, lineHeight: 1 }}>
      Pocca<span style={{ color: ACCENT }}>bet</span>
    </span>
  );
}

// ---------- header ----------
function ThemeButton() {
  const themeBtn = useThemeButton();
  const { theme } = useTheme();
  if (!CAN_SWITCH_THEME) return null;
  return (
    <button aria-label={`Switch theme (now ${THEME_NAMES[theme]})`} {...themeBtn} style={{ position: "relative", width: 40, height: 40, flexShrink: 0, borderRadius: 20, border: "1.5px solid #D8DEEA", background: "transparent", color: NAVY, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <MoonIcon size={16} />
      <span aria-hidden="true" style={{ position: "absolute", right: -5, bottom: -4, padding: "0 4px", height: 15, borderRadius: 8, background: ACCENT, color: "var(--tc-on-accent)", fontSize: 9, fontWeight: 800, lineHeight: "15px" }}>{THEME_BADGE[theme]}</span>
    </button>
  );
}

export function ThemedHeader() {
  const { isAuthenticated, balance, logout } = useAuth();
  const navigate = useNavigate();
  const go = (to: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(to); };
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
  const money = `₦${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const plain: CSSProperties = { height: 40, padding: "0 4px", color: NAVY, fontSize: 14, fontWeight: 700 };
  const filled: CSSProperties = { height: 40, padding: "0 14px", borderRadius: 14, background: ACCENT, color: NAVY, fontSize: 14, fontWeight: 800 };
  const btn = (style: CSSProperties, label: string, onClick: (e: React.MouseEvent) => void, href: string) => (
    <a href={href} onClick={onClick} style={{ display: "flex", alignItems: "center", textDecoration: "none", boxSizing: "border-box", whiteSpace: "nowrap", ...style }}>{label}</a>
  );

  return (
    <header ref={ref} style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#FFFFFF", color: NAVY, padding: "14px 16px", borderRadius: "0 0 24px 24px", boxShadow: "0 6px 24px rgba(11,27,63,0.06)" }}>
      <a href="/" onClick={go("/")} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
        <Logo size={30} />
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ThemeButton />
        {isAuthenticated ? (
          <>
            {btn({ ...plain, fontFamily: NUM_FONT, fontSize: 13 }, money, go("/account"), "/account")}
            {btn(filled, "Log out", (e) => { e.preventDefault(); logout(); }, "#")}
          </>
        ) : (
          <>
            {btn(plain, "Log in", go("/login"), "/login")}
            {btn(filled, "Sign up", go("/signup"), "/signup")}
          </>
        )}
      </div>
    </header>
  );
}

// ---------- sections row ----------
const SECTION_ITEMS: { key: string; label: string }[] = [
  { key: "sports", label: "Football" },
  { key: "live", label: "Live" },
  { key: "today", label: "Today" },
  { key: "aviator", label: "Aviator" },
  { key: "virtuals", label: "Virtuals" },
  { key: "jackpot", label: "Jackpot" },
  { key: "support", label: "Support" },
  { key: "more", label: "More" },
];
const ACTIONS = ["sports", "live", "today", "support", "more"];

export function ThemedSections({ active, liveCount, onSelect }: { active: SectionKey; liveCount: number; onSelect: (key: SectionKey) => void }) {
  return (
    <nav aria-label="Sections" className="tc-hscroll" style={{ display: "flex", gap: 8, padding: "14px 16px 4px", overflowX: "auto" }}>
      {SECTION_ITEMS.map(({ key, label }) => {
        const on = key === active;
        const live = key === "live";
        return (
          <button key={key} aria-current={on ? "page" : undefined} onClick={ACTIONS.includes(key) ? () => onSelect(key as SectionKey) : undefined} style={{
            flexShrink: 0, height: 40, padding: "0 16px", borderRadius: 13, border: "none", boxSizing: "border-box", fontFamily: "inherit", fontSize: 14,
            display: "flex", alignItems: "center", gap: 6,
            background: on ? NAVY : live ? "#FFF0E6" : "#FFFFFF", color: on ? "#FFFFFF" : live ? "#B23E00" : NAVY, fontWeight: live || on ? 800 : 700,
          }}>
            {live && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#F0322B" }} />}
            {label}{live && liveCount > 0 ? ` · ${liveCount}` : ""}
          </button>
        );
      })}
    </nav>
  );
}

// ---------- home top section ----------
function PickButton({ p, style }: { p: PickOfDay; style: CSSProperties }) {
  const { isOn, pick } = usePicker();
  const m = p.m;
  return <OddButton variant="home" value={p.odds} on={isOn(`${m.id}|${p.marketId}|${p.col}`)} aria={p.label} onPick={() => pick(m, p.marketId, p.marketLabel, p.col, p.odds)} style={style} />;
}

function BonusLink({ children, style }: { children: ReactNode; style: CSSProperties }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const to = isAuthenticated ? "/account" : "/signup";
  return <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }} style={{ textDecoration: "none", color: "inherit", ...style }}>{children}</a>;
}

function LiveCard({ m, onOpenMatch }: { m: TCMatch; onOpenMatch: (m: TCMatch) => void }) {
  const { isOn, pick } = usePicker();
  const side = (name: string, logo: string) => (
    <div style={{ width: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <Crest name={name} url={logo} size={44} />
      <span style={{ fontSize: 12, fontWeight: 700, maxWidth: "100%", ...ellipsis }}>{name}</span>
    </div>
  );
  return (
    <section aria-label={`${m.home} vs ${m.away}`} style={{ width: 300, flexShrink: 0, scrollSnapAlign: "start", background: NAVY, color: "#FFFFFF", borderRadius: 26, padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", right: -50, top: -50, width: 170, height: 170, borderRadius: 85, border: `26px solid ${ACCENT}`, boxSizing: "border-box" }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#AEB9D6", minWidth: 0 }}><Flag country={m.country} size={14} /><span style={ellipsis}>{m.league}</span></span>
        {m.live
          ? <span style={{ fontSize: 12, fontWeight: 800, background: m.clock === "HT" ? "#46557A" : "#F0322B", borderRadius: 8, padding: "3px 8px", flexShrink: 0 }}>{m.clock}</span>
          : <span style={{ fontSize: 12, fontWeight: 800, color: "#FFFFFF", flexShrink: 0 }}>{kickoff(m.start)}</span>}
      </div>
      <button onClick={() => onOpenMatch(m)} aria-label={`All markets for ${m.home} vs ${m.away}`} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", border: "none", color: "inherit", padding: 0, fontFamily: "inherit" }}>
        {side(m.home, m.homeLogo)}
        <span style={{ fontFamily: "var(--tc-num)", fontSize: m.live ? 38 : 26, fontWeight: 800, letterSpacing: -1 }}>{m.live ? `${m.hs} : ${m.as}` : hhmm(m.start)}</span>
        {side(m.away, m.awayLogo)}
      </button>
      <div style={{ position: "relative", display: "flex", gap: 8 }}>
        {["1", "X", "2"].map((c, i) => {
          const on = isOn(`${m.id}|1x2|${c}`);
          const v = m.o[i];
          return (
            <button key={c} disabled={!v} aria-label={v ? `${on ? "Remove" : "Add"} ${m.home} vs ${m.away} 1X2 ${c} at ${v.toFixed(2)}` : `${c} suspended`} onClick={() => v && pick(m, "1x2", "1X2", c, v)} style={{
              flex: 1, height: 44, borderRadius: 14, border: "none", background: on ? ACCENT : "var(--day-navy-2)", color: on ? NAVY : v ? "#FFFFFF" : "#6F7DA3",
              fontFamily: "var(--tc-num)", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              <span style={{ fontFamily: "var(--tc-font)", fontSize: 11, opacity: 0.7 }}>{c}</span>{v ? v.toFixed(2) : "—"}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// Live now cards (or the next games when nothing is live), Pick of the day and the bonus.
export function ThemedHero({ potd, live, upcoming, loaded, onLive, onOpenMatch }: {
  potd: PickOfDay | null; live: TCMatch[]; upcoming: TCMatch[]; loaded: boolean; onLive: () => void; onOpenMatch: (m: TCMatch) => void;
}) {
  const cards = live.length ? [...live].sort((a, b) => Number(!a.o[0]) - Number(!b.o[0])).slice(0, 6) : upcoming.slice(0, 6);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 10px" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--tc-display)", fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>{live.length ? "Live now" : "Coming up"}</h2>
        {live.length > 0 && <button onClick={onLive} style={{ border: "none", background: "transparent", color: "var(--tc-accent-text)", fontFamily: "inherit", fontSize: 13, fontWeight: 800, padding: "8px 0" }}>All {live.length}</button>}
      </div>
      <div className="tc-hscroll" style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        {cards.map((m) => <LiveCard key={m.id} m={m} onOpenMatch={onOpenMatch} />)}
        {!cards.length && !loaded && <div aria-hidden="true" style={{ width: 300, height: 200, flexShrink: 0, borderRadius: 26, background: NAVY, opacity: 0.15 }} />}
      </div>
      {potd && (
        <section aria-label="Pick of the day" style={{ margin: "16px 16px 0", background: "#FFFFFF", borderRadius: 22, padding: 16, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 6px 24px rgba(11,27,63,0.05)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--tc-accent-text)" }}><StarIcon />PICK OF THE DAY</span>
          <span style={{ fontFamily: "var(--tc-display)", fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>{potd.m.home} vs {potd.m.away}</span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--tc-page)", borderRadius: 16, padding: "8px 8px 8px 14px" }}>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{potd.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tc-label)", ...ellipsis }}>{potd.note.split(".")[0]}</span>
            </span>
            <PickButton p={potd} style={{ minWidth: 68, height: 44, fontSize: 15, flexShrink: 0 }} />
          </div>
        </section>
      )}
      <BonusLink style={{ margin: "12px 16px 0", background: "#FFF0E6", borderRadius: 22, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Welcome bonus up to <strong style={{ color: "#B23E00" }}>{WELCOME_BONUS_AMOUNT}</strong></span>
        <span style={{ height: 36, padding: "0 14px", borderRadius: 12, background: ACCENT, color: NAVY, display: "flex", alignItems: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>Claim</span>
      </BonusLink>
    </div>
  );
}

// ---------- bottom nav ----------
// White rounded bar; with picks, a navy slip bar floats above it.
type NavKey = "home" | "live" | "mybets" | "account" | null;
export function ThemedBottomNav(p: {
  active: NavKey; liveCount: number; onHome: () => void; onLive: () => void; onSlip: () => void; onMyBets: () => void; onAccount: () => void;
}) {
  const { count, total } = usePicker();
  const tap = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };
  const badge = (n: number, bg: string, color: string) => (
    <span style={{ position: "absolute", top: -6, right: -10, minWidth: 16, padding: "0 4px", height: 16, borderRadius: 8, background: bg, color, fontSize: 10, fontWeight: 800, lineHeight: "16px", textAlign: "center", boxSizing: "border-box" }}>{n}</span>
  );
  const item = (label: string, Icon: typeof HomeIcon, onClick: () => void, key: NavKey, extra?: ReactNode, strong = false) => {
    const on = key !== null && p.active === key;
    return (
      <a key={label} href="#" aria-current={on ? "page" : undefined} onClick={tap(onClick)} style={{ minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: on ? "var(--tc-accent-text)" : strong ? NAVY : "#5B6785", textDecoration: "none", fontSize: 11, fontWeight: on || strong ? 800 : 700 }}>
        <span style={{ position: "relative", display: "flex" }}><Icon size={22} />{extra}</span>{label}
      </a>
    );
  };
  return (
    <>
      {count > 0 && (
        <a href="#" onClick={tap(p.onSlip)} style={{ position: "fixed", left: 12, right: 12, bottom: "calc(86px + env(safe-area-inset-bottom))", zIndex: 40, height: 58, borderRadius: 18, background: NAVY, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 16px", textDecoration: "none", boxShadow: "0 12px 30px rgba(11,27,63,0.3)" }}>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{count} selection{count === 1 ? "" : "s"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#AEB9D6" }}>Total odds {total.toFixed(2)}</span>
          </span>
          <span style={{ height: 42, padding: "0 16px", borderRadius: 13, background: ACCENT, color: NAVY, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 800 }}>Open slip</span>
        </a>
      )}
      <nav aria-label="Main" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, height: 76, paddingBottom: "env(safe-area-inset-bottom)", background: "#FFFFFF", borderRadius: "24px 24px 0 0", boxShadow: "0 -8px 30px rgba(11,27,63,0.08)", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {item("Home", HomeIcon, p.onHome, "home")}
        {item("Live", LiveIcon, p.onLive, "live", p.liveCount > 0 && badge(p.liveCount, "#F0322B", "#FFFFFF"))}
        {item("Slip", ReceiptIcon, p.onSlip, null, count > 0 && badge(count, ACCENT, NAVY), true)}
        {item("My bets", ReceiptIcon, p.onMyBets, "mybets")}
        {item("Account", UserIcon, p.onAccount, "account")}
      </nav>
    </>
  );
}
