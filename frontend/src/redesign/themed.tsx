// The light themes' own phone layout: Bento Pop, Matchday Poster and Daylight each have their
// own header, sections row, home top section and bottom nav. Everything else (lists, slip,
// account…) is shared and takes the theme's colours and fonts from redesign.css.
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CAN_SWITCH_THEME, LIGHT_THEMES, THEME_BADGE, THEME_NAMES, useTheme } from "../context/ThemeContext";
import { type TCMatch, hhmm, kickoff } from "./data";
import { HomeIcon, LiveIcon, MoonIcon, ReceiptIcon, StarIcon, UserIcon } from "./icons";
import { Crest, Flag } from "./media";
import { type SectionKey, featuredLive } from "./mobile";
import type { PickOfDay } from "./potd";
import { ACCENT, NUM_FONT, OddButton, WELCOME_BONUS_AMOUNT, useThemeButton, usePicker } from "./shared";

export type Layout = "classic" | "bento" | "poster" | "daylight";
export function useLayout(): Layout {
  const { theme } = useTheme();
  return LIGHT_THEMES.includes(theme) ? (theme as Layout) : "classic";
}

const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const INK = "#141414"; // Bento Pop outlines
const bentoCard: CSSProperties = { border: `2px solid ${INK}`, borderRadius: 24, boxShadow: `4px 4px 0 ${INK}`, boxSizing: "border-box" };

// ---------- logo ----------
export function Logo({ size = 32 }: { size?: number }) {
  const layout = useLayout();
  if (layout === "bento") {
    return <span style={{ fontFamily: "var(--tc-display)", fontWeight: 800, fontSize: size * 0.68, letterSpacing: -0.6, lineHeight: 1 }}>pocca<span style={{ color: "#FF3D7F" }}>bet</span></span>;
  }
  if (layout === "poster") {
    return <span style={{ fontFamily: "var(--tc-display)", fontStyle: "italic", fontSize: size * 0.86, letterSpacing: 0.5, lineHeight: 1 }}>POCCA<span style={{ color: "var(--poster-orange)" }}>BET</span></span>;
  }
  if (layout === "daylight") {
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
function ThemeButton({ color, line }: { color: string; line: string }) {
  const themeBtn = useThemeButton();
  const { theme } = useTheme();
  if (!CAN_SWITCH_THEME) return null;
  return (
    <button aria-label={`Switch theme (now ${THEME_NAMES[theme]})`} {...themeBtn} style={{ position: "relative", width: 40, height: 40, flexShrink: 0, borderRadius: 20, border: `1.5px solid ${line}`, background: "transparent", color, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <MoonIcon size={16} />
      <span aria-hidden="true" style={{ position: "absolute", right: -5, bottom: -4, padding: "0 4px", height: 15, borderRadius: 8, background: ACCENT, color: "var(--tc-on-accent)", fontSize: 9, fontWeight: 800, lineHeight: "15px" }}>{THEME_BADGE[theme]}</span>
    </button>
  );
}

export function ThemedHeader({ layout }: { layout: Exclude<Layout, "classic"> }) {
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
  }, [layout]);
  const money = `₦${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Two buttons on the right: Log in / Join, or the balance / Log out.
  const styles = {
    bento: {
      bar: { background: "var(--tc-page)", color: INK, padding: "14px 16px 10px" },
      a: { height: 40, padding: "0 12px", borderRadius: 20, border: `2px solid ${INK}`, color: INK, fontSize: 14, fontWeight: 800 },
      b: { height: 40, padding: "0 14px", borderRadius: 20, background: INK, color: "var(--bento-lemon)", fontSize: 14, fontWeight: 800 },
      theme: [INK, INK],
    },
    poster: {
      bar: { background: "var(--poster-blue)", color: "#FFFFFF", padding: "12px 16px" },
      a: { height: 40, padding: "0 4px", color: "#FFFFFF", fontSize: 13, fontWeight: 900, letterSpacing: 1 },
      b: { height: 40, padding: "0 14px", background: "var(--poster-orange)", color: "#0D0D0D", fontSize: 13, fontWeight: 900, letterSpacing: 1, transform: "skewX(-8deg)" },
      theme: ["#FFFFFF", "rgba(255,255,255,0.5)"],
    },
    daylight: {
      bar: { background: "#FFFFFF", color: "var(--day-navy)", padding: "14px 16px", borderRadius: "0 0 24px 24px", boxShadow: "0 6px 24px rgba(11,27,63,0.06)" },
      a: { height: 40, padding: "0 4px", color: "var(--day-navy)", fontSize: 14, fontWeight: 700 },
      b: { height: 40, padding: "0 14px", borderRadius: 14, background: ACCENT, color: "var(--day-navy)", fontSize: 14, fontWeight: 800 },
      theme: ["var(--day-navy)", "#D8DEEA"],
    },
  }[layout];
  const upper = layout === "poster";
  const btn = (style: CSSProperties, label: string, onClick: (e: React.MouseEvent) => void, href: string) => (
    <a href={href} onClick={onClick} style={{ display: "flex", alignItems: "center", textDecoration: "none", boxSizing: "border-box", whiteSpace: "nowrap", ...style }}>{label}</a>
  );

  return (
    <header ref={ref} style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, ...styles.bar }}>
      <a href="/" onClick={go("/")} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
        <Logo size={layout === "daylight" ? 30 : 28} />
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ThemeButton color={styles.theme[0]} line={styles.theme[1]} />
        {isAuthenticated ? (
          <>
            {btn({ ...styles.a, fontFamily: NUM_FONT, fontSize: layout === "poster" ? 18 : 13, letterSpacing: 0 }, money, go("/account"), "/account")}
            {btn(styles.b, upper ? "LOG OUT" : "Log out", (e) => { e.preventDefault(); logout(); }, "#")}
          </>
        ) : (
          <>
            {btn(styles.a, upper ? "LOG IN" : "Log in", go("/login"), "/login")}
            {btn(styles.b, upper ? "JOIN" : layout === "daylight" ? "Sign up" : "Join", go("/signup"), "/signup")}
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

export function ThemedSections({ layout, active, liveCount, onSelect }: {
  layout: Exclude<Layout, "classic">; active: SectionKey; liveCount: number; onSelect: (key: SectionKey) => void;
}) {
  const items = SECTION_ITEMS.map(({ key, label }) => ({
    key, label, on: key === active,
    onClick: ACTIONS.includes(key) ? () => onSelect(key as SectionKey) : undefined,
  }));
  if (layout === "poster") {
    return (
      <nav aria-label="Sections" className="tc-hscroll" style={{ display: "flex", gap: 20, padding: "0 16px", overflowX: "auto", background: "var(--poster-blue)" }}>
        {items.map((it) => (
          <button key={it.key} aria-current={it.on ? "page" : undefined} onClick={it.onClick} style={{
            flexShrink: 0, height: 40, padding: 0, background: "transparent", border: "none", borderBottom: `4px solid ${it.on ? "var(--poster-orange)" : "transparent"}`,
            color: it.on ? "#FFFFFF" : "rgba(255,255,255,0.72)", fontSize: 13, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
          }}>
            {it.label}{it.key === "live" && liveCount > 0 && <span style={{ background: "#FF3B30", color: "#FFFFFF", padding: "0 5px", fontSize: 11 }}>{liveCount}</span>}
          </button>
        ))}
      </nav>
    );
  }
  const bento = layout === "bento";
  return (
    <nav aria-label="Sections" className="tc-hscroll" style={{ display: "flex", gap: 8, padding: bento ? "4px 16px 12px" : "14px 16px 4px", overflowX: "auto" }}>
      {items.map((it) => {
        const live = it.key === "live";
        const style: CSSProperties = bento
          ? { height: 40, padding: "0 16px", borderRadius: 20, border: `2px solid ${INK}`, background: it.on ? INK : "#FFFFFF", color: it.on ? "var(--tc-page)" : INK, fontWeight: 800 }
          : { height: 40, padding: "0 16px", borderRadius: 13, border: "none", background: it.on ? "var(--day-navy)" : live ? "#FFF0E6" : "#FFFFFF", color: it.on ? "#FFFFFF" : live ? "#B23E00" : "var(--day-navy)", fontWeight: live || it.on ? 800 : 700 };
        return (
          <button key={it.key} aria-current={it.on ? "page" : undefined} onClick={it.onClick} style={{ flexShrink: 0, fontSize: 14, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, boxSizing: "border-box", ...style }}>
            {live && <span style={{ width: 8, height: 8, borderRadius: 4, background: "#F0322B" }} />}
            {it.label}{live && liveCount > 0 ? ` ${bento ? "" : "· "}${liveCount}` : ""}
          </button>
        );
      })}
    </nav>
  );
}

// Matchday Poster: running strip of live scores under the header.
export function LiveTicker({ live, onLive }: { live: TCMatch[]; onLive: () => void }) {
  if (!live.length) return null;
  const items = live.slice(0, 8);
  return (
    <button onClick={onLive} aria-label={`${live.length} live games`} className="tc-hscroll" style={{ width: "100%", height: 36, border: "none", background: "#0D0D0D", color: "#FFFFFF", display: "flex", alignItems: "center", gap: 14, padding: "0 16px", overflowX: "auto", whiteSpace: "nowrap", fontFamily: "inherit", fontSize: 12, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" }}>
      <span style={{ background: "#FF3B30", padding: "2px 6px", flexShrink: 0 }}>LIVE {live.length}</span>
      {items.map((m, i) => (
        <span key={m.id} style={{ flexShrink: 0, display: "flex", gap: 6 }}>
          {i > 0 && <span style={{ color: "#6B6B6B" }}>/</span>}
          {m.home} {m.hs}–{m.as} {m.away} <span style={{ color: "var(--poster-orange)" }}>{m.clock}</span>
        </span>
      ))}
    </button>
  );
}

// ---------- home top section ----------
type HeroProps = {
  layout: Exclude<Layout, "classic">; potd: PickOfDay | null; live: TCMatch[]; upcoming: TCMatch[]; loaded: boolean;
  onLive: () => void; onOpenMatch: (m: TCMatch) => void;
};

export function ThemedHero(p: HeroProps) {
  if (p.layout === "bento") return <BentoHero {...p} />;
  if (p.layout === "poster") return <PosterHero {...p} />;
  return <DaylightHero {...p} />;
}

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

function BentoHero({ potd, live, upcoming, onLive }: HeroProps) {
  const lv = featuredLive(live);
  const tonight = new Date().getHours() >= 17;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <h1 style={{ margin: 0, padding: "6px 16px 14px", fontFamily: "var(--tc-display)", fontSize: 30, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>
        Big games,<br /><span style={{ background: "var(--bento-lemon)", padding: "0 6px", borderRadius: 8 }}>{tonight ? "tonight." : "today."}</span>
      </h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, padding: "0 16px" }}>
        {potd ? (
          <section aria-label="Pick of the day" style={{ ...bentoCard, gridColumn: "span 2", background: "var(--bento-lilac)", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
              <span>PICK OF THE DAY</span><span style={{ letterSpacing: 0, fontSize: 12 }}>{kickoff(potd.m.start)}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{ display: "flex", flexShrink: 0 }}>
                <span style={{ borderRadius: 20, border: `2px solid ${INK}`, background: "#FFFFFF", display: "flex" }}><Crest name={potd.m.home} url={potd.m.homeLogo} size={34} /></span>
                <span style={{ borderRadius: 20, border: `2px solid ${INK}`, background: "#FFFFFF", display: "flex", marginLeft: -8 }}><Crest name={potd.m.away} url={potd.m.awayLogo} size={34} /></span>
              </span>
              <span style={{ fontFamily: "var(--tc-display)", fontSize: 17, fontWeight: 700, lineHeight: 1.2, minWidth: 0 }}>{potd.m.home} vs {potd.m.away}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#FFFFFF", border: `2px solid ${INK}`, borderRadius: 16, padding: "8px 8px 8px 14px" }}>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{potd.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#4A4458", ...ellipsis }}>{potd.note.split(".")[0]}</span>
              </span>
              <PickButton p={potd} style={{ minWidth: 70, height: 46, fontSize: 16, flexShrink: 0 }} />
            </div>
          </section>
        ) : (
          <div aria-hidden="true" style={{ ...bentoCard, gridColumn: "span 2", height: 170, background: "var(--bento-lilac)", opacity: 0.6 }} />
        )}
        {lv ? (
          <button onClick={onLive} aria-label={`Live: ${lv.home} ${lv.hs}, ${lv.away} ${lv.as}, ${lv.clock}`} style={{ ...bentoCard, background: "var(--bento-mint)", padding: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, textAlign: "left", fontFamily: "inherit", color: INK }}>
            <span style={{ fontSize: 11, fontWeight: 800, background: "#FF3D3D", color: "#FFFFFF", borderRadius: 8, padding: "2px 8px" }}>LIVE {lv.clock}</span>
            <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3, width: "100%" }}><span style={{ display: "block", ...ellipsis }}>{lv.home}</span><span style={{ display: "block", ...ellipsis }}>{lv.away}</span></span>
            <span style={{ fontFamily: "var(--tc-display)", fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{lv.hs}–{lv.as}</span>
          </button>
        ) : (
          <div style={{ ...bentoCard, background: "var(--bento-mint)", padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>UP NEXT</span>
            <span style={{ fontFamily: "var(--tc-display)", fontSize: 26, fontWeight: 800 }}>{upcoming.length}</span>
            <span style={{ fontSize: 13, fontWeight: 800 }}>matches to bet on</span>
          </div>
        )}
        <BonusLink style={{ ...bentoCard, background: "var(--bento-peach)", padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>NEW HERE?</span>
          <span style={{ fontFamily: "var(--tc-display)", fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{WELCOME_BONUS_AMOUNT}<br />bonus</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>Claim it →</span>
        </BonusLink>
      </div>
    </div>
  );
}

function PosterHero({ potd, upcoming, loaded }: HeroProps) {
  const { isOn, pick } = usePicker();
  const m = potd?.m ?? upcoming[0];
  if (!m) return loaded ? null : <div aria-hidden="true" style={{ margin: "16px 16px 0", height: 250, background: "#0D0D0D", opacity: 0.15 }} />;
  const names = ["1", "X", "2"];
  const labels = [m.home, "Draw", m.away];
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <section aria-label={potd ? "Pick of the day" : "Featured match"} style={{ position: "relative", margin: "16px 16px 0", background: "#0D0D0D", color: "#FFFFFF", padding: "18px 18px 16px", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", right: -40, top: -20, width: 190, height: 280, background: "var(--poster-orange)", clipPath: "polygon(38% 0, 100% 0, 62% 100%, 0 100%)" }} />
        <div aria-hidden="true" style={{ position: "absolute", right: 40, top: -20, width: 70, height: 280, background: "var(--poster-blue)", clipPath: "polygon(50% 0, 100% 0, 50% 100%, 0 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4, paddingRight: 90 }}>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "var(--poster-orange)" }}>{potd ? "PICK OF THE DAY" : "BIG MATCH"}<br />{kickoff(m.start).toUpperCase()}</span>
          <h1 style={{ margin: 0, fontFamily: "var(--tc-display)", fontWeight: 400, fontSize: 40, lineHeight: 0.98, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {m.home}<br /><span style={{ fontSize: 24, color: "#9A9A9A" }}>VS</span> {m.away}
          </h1>
          {potd && <span style={{ fontSize: 12, fontWeight: 700, color: "#CFCFCF", marginTop: 4 }}>{potd.note.split(".")[0]}</span>}
        </div>
        <div style={{ position: "relative", display: "flex", marginTop: 14, background: "#F2EFE8" }}>
          {names.map((c, i) => {
            const on = isOn(`${m.id}|1x2|${c}`);
            const v = m.o[i];
            return (
              <button key={c} disabled={!v} aria-label={`${on ? "Remove" : "Add"} ${m.home} vs ${m.away} 1X2 ${c} at ${v.toFixed(2)}`} onClick={() => v && pick(m, "1x2", "1X2", c, v)} style={{
                flex: 1, minWidth: 0, height: 60, border: "none", borderRight: i < 2 ? "2px dashed #0D0D0D" : "none", background: on ? "var(--poster-blue)" : "transparent",
                color: on ? "#FFFFFF" : "#0D0D0D", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
              }}>
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", maxWidth: "90%", ...ellipsis }}>{labels[i]}</span>
                <span style={{ fontFamily: "var(--tc-num)", fontSize: 24 }}>{v ? v.toFixed(2) : "—"}</span>
              </button>
            );
          })}
        </div>
      </section>
      <BonusLink style={{ margin: "12px 16px 0", background: "var(--poster-orange)", color: "#0D0D0D", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--tc-display)", fontSize: 22, letterSpacing: 0.5 }}>{WELCOME_BONUS_AMOUNT} WELCOME BONUS</span>
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>CLAIM →</span>
      </BonusLink>
    </div>
  );
}

function DaylightLiveCard({ m, onOpenMatch }: { m: TCMatch; onOpenMatch: (m: TCMatch) => void }) {
  const { isOn, pick } = usePicker();
  const side = (name: string, logo: string) => (
    <div style={{ width: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <Crest name={name} url={logo} size={44} />
      <span style={{ fontSize: 12, fontWeight: 700, maxWidth: "100%", ...ellipsis }}>{name}</span>
    </div>
  );
  return (
    <section aria-label={`${m.home} vs ${m.away}`} style={{ width: 300, flexShrink: 0, scrollSnapAlign: "start", background: "var(--day-navy)", color: "#FFFFFF", borderRadius: 26, padding: 16, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden" }}>
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
              flex: 1, height: 44, borderRadius: 14, border: "none", background: on ? ACCENT : "var(--day-navy-2)", color: on ? "var(--day-navy)" : v ? "#FFFFFF" : "#6F7DA3",
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

function DaylightHero({ potd, live, upcoming, loaded, onLive, onOpenMatch }: HeroProps) {
  const cards = live.length ? [...live].sort((a, b) => Number(!a.o[0]) - Number(!b.o[0])).slice(0, 6) : upcoming.slice(0, 6);
  const heading = (title: string, action?: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 10px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--tc-display)", fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>{title}</h2>
      {action}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {heading(live.length ? "Live now" : "Coming up", live.length > 0 && <button onClick={onLive} style={{ border: "none", background: "transparent", color: "var(--tc-accent-text)", fontFamily: "inherit", fontSize: 13, fontWeight: 800, padding: "8px 0" }}>All {live.length}</button>)}
      <div className="tc-hscroll" style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        {cards.map((m) => <DaylightLiveCard key={m.id} m={m} onOpenMatch={onOpenMatch} />)}
        {!cards.length && !loaded && <div aria-hidden="true" style={{ width: 300, height: 200, flexShrink: 0, borderRadius: 26, background: "var(--day-navy)", opacity: 0.15 }} />}
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
        <span style={{ height: 36, padding: "0 14px", borderRadius: 12, background: ACCENT, color: "var(--day-navy)", display: "flex", alignItems: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>Claim</span>
      </BonusLink>
    </div>
  );
}

// ---------- bottom nav ----------
type NavKey = "home" | "live" | "mybets" | "account" | null;
type NavProps = {
  layout: Exclude<Layout, "classic">; active: NavKey; liveCount: number;
  onHome: () => void; onLive: () => void; onSlip: () => void; onMyBets: () => void; onAccount: () => void;
};

export function ThemedBottomNav(p: NavProps) {
  const { count, total } = usePicker();
  const tap = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };
  const items: { key: NavKey; label: string; Icon: typeof HomeIcon; onClick: () => void }[] = [
    { key: "home", label: "Home", Icon: HomeIcon, onClick: p.onHome },
    { key: "live", label: "Live", Icon: LiveIcon, onClick: p.onLive },
    { key: "mybets", label: "My bets", Icon: ReceiptIcon, onClick: p.onMyBets },
    { key: "account", label: "Account", Icon: UserIcon, onClick: p.onAccount },
  ];
  const liveBadge = (key: NavKey) => key === "live" && p.liveCount > 0 && (
    <span style={{ position: "absolute", top: -6, right: -12, padding: "0 5px", height: 16, borderRadius: 8, background: "#F0322B", color: "#FFFFFF", fontSize: 10, fontWeight: 800, lineHeight: "16px" }}>{p.liveCount}</span>
  );

  if (p.layout === "bento") {
    const circle = (it: typeof items[number]) => {
      const on = p.active === it.key;
      return (
        <a key={it.label} href="#" aria-label={it.label} aria-current={on ? "page" : undefined} onClick={tap(it.onClick)} style={{ position: "relative", width: 48, height: 48, borderRadius: 24, background: on ? "var(--tc-page)" : "transparent", color: on ? INK : "var(--tc-page)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ position: "relative", display: "flex" }}><it.Icon size={22} />{liveBadge(it.key)}</span>
        </a>
      );
    };
    return (
      <nav aria-label="Main" style={{ position: "fixed", left: 12, right: 12, bottom: "calc(14px + env(safe-area-inset-bottom))", zIndex: 40, height: 66, borderRadius: 33, background: INK, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 6px", boxShadow: "0 10px 30px rgba(20,20,20,0.25)" }}>
        {circle(items[0])}{circle(items[1])}
        <a href="#" aria-label={`Bet slip, ${count} selections`} onClick={tap(p.onSlip)} style={{ height: 48, padding: "0 16px", borderRadius: 24, background: "var(--bento-lemon)", color: INK, display: "flex", alignItems: "center", gap: 8, textDecoration: "none", fontWeight: 800, fontSize: 14 }}>
          {count ? `Odds ${total.toFixed(2)}` : "Slip"}
          <span style={{ fontFamily: "var(--tc-display)", background: INK, color: "var(--bento-lemon)", borderRadius: 12, padding: "1px 8px", fontSize: 13 }}>{count}</span>
        </a>
        {circle(items[2])}{circle(items[3])}
      </nav>
    );
  }

  if (p.layout === "poster") {
    const cell = (it: typeof items[number]) => {
      const on = p.active === it.key;
      return (
        <a key={it.label} href="#" aria-current={on ? "page" : undefined} onClick={tap(it.onClick)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: on ? "var(--poster-blue)" : "#0D0D0D", textDecoration: "none", fontSize: 10, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase" }}>
          <span style={{ position: "relative", display: "flex" }}><it.Icon size={22} />{liveBadge(it.key)}</span>{it.label}
        </a>
      );
    };
    return (
      <nav aria-label="Main" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, height: 70, paddingBottom: "env(safe-area-inset-bottom)", background: "#FFFFFF", borderTop: "3px solid #0D0D0D", display: "flex", alignItems: "stretch" }}>
        {cell(items[0])}{cell(items[1])}
        <a href="#" aria-label={`Bet slip, ${count} selections`} onClick={tap(p.onSlip)} style={{ flex: 1.2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, background: "var(--poster-orange)", color: "#0D0D0D", textDecoration: "none", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
          <span style={{ fontFamily: "var(--tc-num)", fontSize: 24, letterSpacing: 0, lineHeight: 1.1 }}>{count}</span>{count ? `ODDS ${total.toFixed(2)}` : "BET SLIP"}
        </a>
        {cell(items[2])}{cell(items[3])}
      </nav>
    );
  }

  // Daylight: white rounded bar; with picks, a navy slip bar floats above it.
  return (
    <>
      {count > 0 && (
        <a href="#" onClick={tap(p.onSlip)} style={{ position: "fixed", left: 12, right: 12, bottom: "calc(86px + env(safe-area-inset-bottom))", zIndex: 40, height: 58, borderRadius: 18, background: "var(--day-navy)", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 16px", textDecoration: "none", boxShadow: "0 12px 30px rgba(11,27,63,0.3)" }}>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{count} selection{count === 1 ? "" : "s"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#AEB9D6" }}>Total odds {total.toFixed(2)}</span>
          </span>
          <span style={{ height: 42, padding: "0 16px", borderRadius: 13, background: ACCENT, color: "var(--day-navy)", display: "flex", alignItems: "center", fontSize: 14, fontWeight: 800 }}>Open slip</span>
        </a>
      )}
      <nav aria-label="Main" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, height: 76, paddingBottom: "env(safe-area-inset-bottom)", background: "#FFFFFF", borderRadius: "24px 24px 0 0", boxShadow: "0 -8px 30px rgba(11,27,63,0.08)", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {[items[0], items[1]].map((it) => dayItem(it, p.active === it.key, tap(it.onClick), liveBadge(it.key)))}
        {dayItem({ label: "Slip", Icon: ReceiptIcon }, false, tap(p.onSlip),
          count > 0 && <span style={{ position: "absolute", top: -6, right: -10, minWidth: 16, padding: "0 4px", height: 16, borderRadius: 8, background: ACCENT, color: "var(--day-navy)", fontSize: 10, fontWeight: 800, lineHeight: "16px", textAlign: "center", boxSizing: "border-box" }}>{count}</span>, true)}
        {[items[2], items[3]].map((it) => dayItem(it, p.active === it.key, tap(it.onClick), null))}
      </nav>
    </>
  );
}

function dayItem(it: { label: string; Icon: typeof HomeIcon }, on: boolean, onClick: (e: React.MouseEvent) => void, badge: ReactNode, slip = false) {
  return (
    <a key={it.label} href="#" aria-current={on ? "page" : undefined} onClick={onClick} style={{ minWidth: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: on ? "var(--tc-accent-text)" : slip ? "var(--day-navy)" : "#5B6785", textDecoration: "none", fontSize: 11, fontWeight: on || slip ? 800 : 700 }}>
      <span style={{ position: "relative", display: "flex" }}><it.Icon size={22} />{badge}</span>{it.label}
    </a>
  );
}
