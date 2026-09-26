import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, type BookedLeg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { THEMES, useTheme } from "../context/ThemeContext";
import { useBetSlip } from "../context/BetSlipContext";
import { useDeviceState } from "../lib/browser";
import type { Dir, TCMatch } from "./data";
import { ChevronLeft, CheckIcon, CloseIcon, CopyIcon, LockIcon, ReceiptIcon, ShareIcon } from "./icons";
import { CORRECT_SCORE, MK, deriveOdds } from "./markets";
import { dayLabel, hhmm } from "./data";
import { Crest, Flag } from "./media";

// Theme colours and fonts (set per theme in redesign.css). ACCENT fills buttons and selections;
// ACCENT_TEXT is the accent as text (a darker shade on light themes, so it stays readable);
// ON_ACCENT is text on an ACCENT fill; NUM_FONT is for odds, scores and big numbers.
export const ACCENT = "var(--tc-accent)";
export const ACCENT_TEXT = "var(--tc-accent-text)";
export const ON_ACCENT = "var(--tc-on-accent)";
export const NUM_FONT = "var(--tc-num)";
export const WELCOME_BONUS_AMOUNT = "₦50,000";
// One switch for the featured-match card at the top of the Live, Upcoming and Top leagues tabs.
export const SHOW_TAB_FEATURE = true;

export function useIsDesktop() {
  const query = "(min-width: 900px)";
  const [desk, setDesk] = useDeviceState(() => window.matchMedia(query).matches, false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesk(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desk;
}

// Anonymous device id for counting picks (one vote per device per match per day).
function deviceId() {
  try {
    let id = localStorage.getItem("pocca-device-id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("pocca-device-id", id);
    }
    return id;
  } catch {
    return "";
  }
}

function recordPick(m: TCMatch, market: string, selection: string | null) {
  const id = deviceId();
  if (!id || m.live) return; // only pre-match picks feed Pick of the day
  api.recordPick({
    deviceId: id, matchId: m.id, market, selection, home: m.home, away: m.away, league: m.league,
    country: m.country, homeLogo: m.homeLogo, awayLogo: m.awayLogo, kickoff: new Date(m.start).toISOString(),
  }).catch(() => {});
}

// ---------- picks (one selection per match, as in the design) ----------
export function usePicker() {
  const { selections, addSelection, removeSelection } = useBetSlip();
  const isOn = (id: string) => selections.some((s) => s.outcomeId === id);
  const pick = (m: TCMatch, marketId: string, marketLabel: string, col: string, odds: number) => {
    const id = `${m.id}|${marketId}|${col}`;
    if (isOn(id)) {
      recordPick(m, marketId, null);
      return removeSelection(id);
    }
    selections.filter((s) => s.outcomeId.startsWith(`${m.id}|`)).forEach((s) => removeSelection(s.outcomeId));
    addSelection({ outcomeId: id, label: col, odds, marketName: marketLabel, eventLabel: `${m.home} vs ${m.away}` });
    recordPick(m, marketId, col);
  };
  const total = selections.reduce((acc, s) => acc * s.odds, 1);
  return { isOn, pick, count: selections.length, total };
}

// ---------- odds button ----------
type Variant = "home" | "live" | "desk";
export function OddButton({
  value, on, dir = "", variant, onPick, aria, style, lockSize, flash = 0,
}: {
  value: number; on: boolean; dir?: Dir; variant: Variant; onPick: () => void; aria: string;
  style: CSSProperties; lockSize?: number; flash?: number;
}) {
  const locked = !value;
  // One odds-tile colour everywhere (the live tile colour), so every tab looks the same.
  const idle = "var(--tc-odd)";
  const lockedBg = variant === "desk" ? "var(--tc-panel-2)" : "var(--tc-panel)";
  // The arrow only appears when this price just moved, and flashes once (keyed on the value,
  // so the next move restarts it).
  const showArrow = !!dir && !locked;
  return (
    <button
      className="tc-odd-btn"
      aria-label={locked ? `${aria} suspended` : `${on ? "Remove" : "Add"} ${aria} at ${value.toFixed(2)}${dir ? `, odds moving ${dir}` : ""}`}
      onClick={locked ? undefined : onPick}
      disabled={locked}
      style={{
        position: "relative", padding: 0, borderRadius: "var(--tc-odd-radius)", border: locked ? "none" : "var(--tc-odd-border)", boxSizing: "border-box",
        background: locked ? lockedBg : on ? "var(--tc-sel)" : idle,
        color: locked ? "var(--tc-faint)" : on ? "var(--tc-sel-text)" : "var(--tc-odd-text)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: NUM_FONT, fontWeight: 700,
        ...style,
      }}
    >
      {locked && <LockIcon size={lockSize ?? (variant === "desk" ? 15 : 16)} />}
      {showArrow && (
        <span
          key={`${value}-${dir}`}
          aria-hidden="true"
          className="tc-odds-trend"
          style={{
            top: dir === "down" ? "auto" : 4, right: dir === "down" ? "auto" : 4,
            bottom: dir === "down" ? 4 : "auto", left: dir === "down" ? 4 : "auto",
            background: on ? "var(--tc-sel-text)" : dir === "up" ? "#2AB572" : "#E5484D",
            transform: dir === "down" ? "rotate(180deg)" : "none",
            animation: `odds-flash 7s linear ${((flash * 0.15) % 0.9).toFixed(2)}s 1 both`,
          }}
        />
      )}
      {!locked && <span style={{ position: "relative", zIndex: 1 }}>{value.toFixed(2)}</span>}
    </button>
  );
}

// ---------- bottom sheet (mobile) ----------
// Bottom sheet. Swipe down to close: drag the handle, or anywhere once the sheet is scrolled
// to its top. Past ~110px (or a quick flick) it closes; otherwise it springs back.
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; active: boolean } | null>(null);
  const [dy, setDy] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    drag.current = { y: e.touches[0].clientY, t: Date.now(), active: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.touches[0].clientY - d.y;
    // Only pull the sheet down when its own content is at the top.
    if (!d.active && (delta <= 0 || (panel.current?.scrollTop ?? 0) > 0)) return;
    d.active = true;
    setDy(Math.max(0, delta));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const fast = dy > 40 && Date.now() - d.t < 250;
    if (dy > 110 || fast) close();
    else setDy(0);
  };

  const offset = closing ? "100%" : `${dy}px`;
  const dragging = drag.current?.active;
  return (
    <>
      <div onClick={close} style={{
        position: "fixed", inset: 0, background: "rgba(8,12,15,0.62)", zIndex: 60,
        opacity: closing ? 0 : Math.max(0.3, 1 - dy / 400), transition: "opacity 0.18s",
      }} />
      <div ref={panel} role="dialog" aria-label={label}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, width: "min(100%, 520px)", margin: "0 auto", maxHeight: "80vh", zIndex: 61, display: "flex", flexDirection: "column",
          background: "var(--tc-panel)", borderRadius: "18px 18px 0 0", boxShadow: "0 -12px 32px rgba(0,0,0,0.4)", overflowY: "auto",
          overscrollBehavior: "contain", paddingBottom: "env(safe-area-inset-bottom)",
          transform: `translateY(${offset})`, transition: dragging ? "none" : "transform 0.18s ease-out",
        }}>
        {/* Grab handle — a taller touch area than the bar itself */}
        <div aria-hidden="true" style={{ display: "flex", justifyContent: "center", padding: "8px 0 6px", touchAction: "none" }}>
          <span style={{ width: 40, height: 4, borderRadius: 2, background: "var(--tc-outline-strong)" }} />
        </div>
        {children}
      </div>
    </>
  );
}

export function SheetTitle({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 6px 20px" }}>
      <span style={{ fontSize: 17, fontWeight: 800 }}>{title}</span>
      <button aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, border: "none", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CloseIcon />
      </button>
    </div>
  );
}

// Markets grouped by category, shown as wrapping chips so the sheet stays short
// and the matches behind remain visible.
const MARKET_SHEET_GROUPS: { title: string; groups: string[] }[] = [
  { title: "MAIN", groups: ["MAIN"] },
  { title: "GOALS", groups: ["GOALS"] },
  { title: "HANDICAP & HALVES", groups: ["HANDICAP", "HALVES"] },
];

export function MarketsSheet({ active, onPick, onClose }: { active: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet label="Popular markets" onClose={onClose}>
      <SheetTitle title="Popular markets" onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 20px 20px" }}>
        {MARKET_SHEET_GROUPS.map((g) => (
          <div key={g.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--tc-label)" }}>{g.title}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MK.filter((m) => g.groups.includes(m.group)).map((m) => {
                const on = m.id === active;
                return (
                  <button key={m.id} aria-pressed={on} onClick={() => onPick(m.id)} style={{
                    height: 40, padding: "0 14px", borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
                    border: `1px solid ${on ? ACCENT : "var(--tc-outline)"}`, background: on ? ACCENT : "transparent",
                    color: on ? ON_ACCENT : "var(--tc-text)", fontSize: 14, fontWeight: on ? 800 : 600, whiteSpace: "nowrap",
                  }}>
                    {on && <CheckIcon size={14} />}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// ---------- bet slip (desktop rail; also the mobile bet-slip sheet) ----------
const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };
const naira = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---------- loading ----------
// Once the loader shows, it stays until the yellow has lit 1, X and 2 at least once (one full
// pass, ~1.7s), even if the data arrives sooner. Nothing loading at first = it never shows.
export const LOADER_MIN_MS = 1700;
export function useMinLoading(loading: boolean, minMs = LOADER_MIN_MS) {
  const started = useRef<number | null>(loading ? Date.now() : null);
  const [show, setShow] = useState(loading);
  useEffect(() => {
    if (loading) {
      if (started.current === null) started.current = Date.now();
      setShow(true);
      return;
    }
    if (started.current === null) return setShow(false);
    const left = minMs - (Date.now() - started.current);
    const done = () => { started.current = null; setShow(false); };
    if (left <= 0) return done();
    const t = setTimeout(done, left);
    return () => clearTimeout(t);
  }, [loading, minMs]);
  return show;
}

// The splash's 1 X 2 animation, for anything that's loading.
export function Loader({ label, compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div role="status" aria-live="polite" style={{ padding: compact ? "16px" : "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <span className="tc-loader" aria-hidden="true"><i>1</i><i>X</i><i>2</i></span>
      <span style={{ fontSize: 13, color: "var(--tc-label)" }}>{label ?? "Loading…"}</span>
    </div>
  );
}

// ---------- state that survives a reload ----------
// "local": kept on the device (e.g. the stake you like). "session": kept until the browser tab
// is closed (where you were on the page), so a new visit starts fresh.
export function useStoredState<T>(key: string, initial: T, where: "local" | "session" = "local") {
  const store = () => (where === "local" ? window.localStorage : window.sessionStorage);
  const [value, setValue] = useDeviceState<T>(() => {
    const raw = store().getItem(key);
    return raw === null ? initial : (JSON.parse(raw) as T);
  }, initial);
  useEffect(() => {
    try { store().setItem(key, JSON.stringify(value)); } catch { /* storage blocked: just not remembered */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue] as const;
}

// Keeps the slip's prices in step with the feed: new odds come in, suspended or finished
// matches show as unavailable (and come back if they reopen). Runs whenever the feed refreshes.
export function useSyncSlipWithFeed(matches: TCMatch[], ready: boolean) {
  const { selections, updateSelections } = useBetSlip();
  useEffect(() => {
    if (!ready || !selections.length) return;
    const byId = new Map(matches.map((m) => [m.id, m]));
    const changes: Record<string, { odds?: number; unavailable?: boolean }> = {};
    for (const s of selections) {
      const [matchId, market, col] = s.outcomeId.split("|");
      if (!market) continue; // Theme D selection
      const m = byId.get(matchId);
      const cols = market === "cs" ? CORRECT_SCORE.cols : MK.find((x) => x.id === market)?.cols;
      const price = m && cols ? deriveOdds(m.o, m.ou)[market]?.[cols.indexOf(col)] ?? 0 : 0;
      const unavailable = !(price > 1);
      const odds = unavailable ? s.odds : price;
      if (odds !== s.odds || unavailable !== !!s.unavailable) changes[s.outcomeId] = { odds, unavailable };
    }
    if (Object.keys(changes).length) updateSelections(changes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, ready]);
}

// ---------- copy & share (booking codes, tickets) ----------
// Copy works on https/localhost through the clipboard API; over plain http (e.g. testing on a
// phone over the local network) it falls back to a hidden text box.
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand("copy");
    box.remove();
    return ok;
  }
}
// The phone's share menu (WhatsApp, SMS, …) where there is one; otherwise copy the message.
export async function shareText(text: string, url?: string): Promise<"shared" | "copied" | "failed"> {
  if (navigator.share) {
    try {
      await navigator.share({ text, ...(url ? { url } : {}) });
      return "shared";
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return "failed"; // user closed the menu
    }
  }
  return (await copyText(url ? `${text}\n${url}` : text)) ? "copied" : "failed";
}

// Shared links must open on the public site, even when sharing from a local test copy
// (a phone can't open "192.168…" or "localhost", and chat apps can't build a preview for it).
// VITE_PUBLIC_URL sets it per deployment (e.g. the Theme-A-only site); otherwise the live site.
const LOCAL = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
export const publicOrigin = () =>
  String(import.meta.env.VITE_PUBLIC_URL || (LOCAL.test(location.hostname) ? "https://poccabet.vercel.app" : location.origin)).replace(/\/$/, "");

// Anyone opening this link gets the booked slip loaded (useBookingLink below).
export const bookingLink = (code: string) => `${publicOrigin()}/?book=${encodeURIComponent(code)}`;

// What gets shared. The link goes separately (share menus put it last, with its preview).
const slipLine = (count: number, odds: number) =>
  `${count} selection${count === 1 ? "" : "s"}${count > 1 ? ` · total odds ${odds.toFixed(2)}` : ` · odds ${odds.toFixed(2)}`}`;
export const bookingShare = (code: string, count: number, odds: number) => ({
  text: `My Poccabet slip is ready ⚽\n${slipLine(count, odds)}\nBooking code: ${code}\nTap the link to load it, or enter the code in the bet slip:`,
  url: bookingLink(code),
});
export const ticketShare = (ticket: string, count: number, odds: number) => ({
  text: `I just placed a bet on Poccabet ⚽\nTicket ID: ${ticket} · ${slipLine(count, odds)}\nCheck it anytime:`,
  url: publicOrigin(),
});

// A booked leg (with today's price) as a slip selection.
const toSelection = (l: BookedLeg) => ({
  outcomeId: `${l.matchId}|${l.market}|${l.selection}`, label: l.selection, odds: l.odds, marketName: l.marketLabel, eventLabel: `${l.home} vs ${l.away}`,
});

// Opening a shared booking link (/?book=CODE) loads that slip; `onLoaded` shows it (mobile: opens the slip sheet).
export function useBookingLink(onLoaded: () => void) {
  const { replaceAll } = useBetSlip();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("book");
    if (!code) return;
    params.delete("book");
    navigate({ pathname: window.location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true });
    api.loadSlip(code)
      .then((res) => { if (res.available.length) { replaceAll(res.available.map(toSelection)); onLoaded(); } })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

const iconBtn: CSSProperties = {
  width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: "1px solid var(--tc-outline)",
  background: "var(--tc-page)", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center",
};

// One code with its Copy and Share buttons. The icons confirm with a tick for a moment.
export function CodeRow({ code, share }: { code: string; share: { text: string; url?: string } }) {
  const [done, setDone] = useState<"copy" | "share" | null>(null);
  const flash = (what: "copy" | "share") => { setDone(what); setTimeout(() => setDone(null), 1600); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1, minWidth: 0, fontFamily: NUM_FONT, fontSize: 30, fontWeight: 700, letterSpacing: 2, lineHeight: 1, userSelect: "all" }}>{code}</span>
      <button aria-label={`Copy ${code}`} title="Copy" onClick={async () => { if (await copyText(code)) flash("copy"); }} style={iconBtn}>
        {done === "copy" ? <CheckIcon size={18} style={{ color: "#2AB572" }} /> : <CopyIcon />}
      </button>
      <button aria-label={`Share ${code}`} title="Share" onClick={async () => { if ((await shareText(share.text, share.url)) !== "failed") flash("share"); }} style={{ ...iconBtn, background: ACCENT, border: "none", color: ON_ACCENT }}>
        {done === "share" ? <CheckIcon size={18} /> : <ShareIcon />}
      </button>
    </div>
  );
}

type CodeCardData = { kind: "booking" | "ticket"; codes: { code: string; count: number; odds: number }[] };

// Shown at the top of the slip after Book bet / Place bet: the code(s), big, with Copy & Share.
function CodeCard({ data, onClose, onViewBets }: { data: CodeCardData; onClose: () => void; onViewBets: () => void }) {
  const booking = data.kind === "booking";
  return (
    <section aria-label={booking ? "Booking code" : "Ticket ID"} style={{ margin: "0 16px 14px", padding: "12px 14px 14px", borderRadius: 12, border: `1px solid ${booking ? ACCENT : "#2AB572"}`, background: "var(--tc-card)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, letterSpacing: 0.8, color: booking ? ACCENT : "#2AB572" }}>
          {!booking && <CheckIcon size={14} />}
          {booking ? "BOOKING CODE" : data.codes.length > 1 ? `${data.codes.length} BETS PLACED · TICKET IDS` : "BET PLACED · TICKET ID"}
        </span>
        <button aria-label="Close" onClick={onClose} style={{ width: 32, height: 32, margin: -6, border: "none", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CloseIcon size={14} />
        </button>
      </div>
      {data.codes.map((c) => (
        <CodeRow key={c.code} code={c.code} share={booking ? bookingShare(c.code, c.count, c.odds) : ticketShare(c.code, c.count, c.odds)} />
      ))}
      <span style={{ fontSize: 12, color: "var(--tc-label)" }}>
        {booking
          ? "Anyone can load this slip with the code or the shared link."
          : <>Track it in <a href="/my-bets" onClick={(e) => { e.preventDefault(); onViewBets(); }}>My Bets</a>, or check it anytime with this ID.</>}
      </span>
    </section>
  );
}

// Slip selections from the redesign carry "<matchId>|<market>|<selection>" as their id.
const legOf = (outcomeId: string) => {
  const [matchId, market, selection] = outcomeId.split("|");
  return { matchId, market, selection };
};
// A fresh key per slip submission (so a retried request can't bet twice). crypto.randomUUID
// only exists on https/localhost, so there's a fallback for testing over the local network.
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const ANY_ODDS_KEY = "pocca-accept-any-odds";

type Msg = { text: ReactNode; tone: "info" | "ok" | "warn" | "error" };
const TONE: Record<Msg["tone"], string> = { info: "var(--tc-label)", ok: "#2AB572", warn: ACCENT, error: "#E5484D" };

// `onBack`: shown as a full page (/betslip) — a back arrow by the title; the stake / Place bet
// panel follows the selections and scrolls with them.
export function BetSlipBody({ inSheet = false, onBack }: { inSheet?: boolean; onBack?: () => void }) {
  const { selections, removeSelection, clear, updateSelections, replaceAll } = useBetSlip();
  const { isAuthenticated, setBalance, demo } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useStoredState<"multiple" | "single">("pocca-slip-mode", "multiple");
  const [stake, setStake] = useStoredState("pocca-slip-stake", 1000);
  const [code, setCode] = useStoredState("pocca-slip-code", "", "session");
  const [msg, setMsg] = useState<Msg | null>(null);
  const [codeCard, setCodeCard] = useState<CodeCardData | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const showCodeLoader = useMinLoading(loadingCode);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false); // prices moved: the button asks to accept them
  const [anyOdds, setAnyOdds] = useDeviceState(() => localStorage.getItem(ANY_ODDS_KEY) === "1", false);

  // Same slip + stake + mode = same key; anything changes = a new submission.
  const signature = `${mode}|${stake}|${selections.map((s) => `${s.outcomeId}@${s.odds}`).join(",")}`;
  const keyRef = useRef({ signature: "", key: "" });
  if (keyRef.current.signature !== signature) keyRef.current = { signature, key: newKey() };

  const count = selections.length;
  const blocked = selections.some((s) => s.unavailable);
  const live = selections.filter((s) => !s.unavailable);
  const total = live.reduce((a, s) => a * s.odds, 1);
  const win = mode === "multiple" ? stake * total : live.reduce((a, s) => a + stake * s.odds, 0);
  const totalStake = mode === "multiple" || count <= 1 ? stake : stake * count;

  function toggleAnyOdds(v: boolean) {
    setAnyOdds(v);
    try { localStorage.setItem(ANY_ODDS_KEY, v ? "1" : "0"); } catch { /* ignore */ }
  }

  async function place() {
    if (!isAuthenticated) return navigate("/login");
    if (!count || busy) return;
    if (blocked) return setMsg({ tone: "warn", text: "Remove the selections that are no longer available, then place your bet." });
    setBusy(true);
    setMsg(null);
    setCodeCard(null);
    try {
      const res = await api.placeBets({
        mode, stake, acceptOdds: anyOdds ? "any" : "higher", idempotencyKey: keyRef.current.key,
        selections: selections.map((s) => ({ ...legOf(s.outcomeId), odds: s.odds })),
      });
      setBalance(res.balance);
      clear();
      setChanged(false);
      setCodeCard({ kind: "ticket", codes: res.bets.map((b) => ({ code: b.ticket, count: b.selections.length, odds: b.totalOdds })) });
    } catch (err) {
      if (err instanceof ApiError && (err.code === "ODDS_CHANGED" || err.code === "SELECTIONS_UNAVAILABLE")) {
        const changes: Record<string, { odds?: number; unavailable?: boolean }> = {};
        for (const p of err.details?.problems ?? []) {
          const id = `${p.matchId}|${p.market}|${p.selection}`;
          changes[id] = p.reason === "ODDS_CHANGED" ? { odds: p.odds } : { unavailable: true };
        }
        updateSelections(changes);
        setChanged(err.code === "ODDS_CHANGED");
        setMsg({ tone: "warn", text: err.code === "ODDS_CHANGED" ? "Some odds have changed. Check the new prices, then accept to place." : "Some selections can't be bet on any more. Remove them to continue." });
      } else if (err instanceof ApiError && err.code === "INSUFFICIENT_FUNDS") {
        setMsg({ tone: "error", text: demo ? `${err.message} Claim your welcome bonus in your account.` : err.message });
      } else {
        setMsg({ tone: "error", text: err instanceof Error ? err.message : "Couldn't place the bet" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function book() {
    if (!live.length || busy) return setMsg({ tone: "info", text: "Add selections to book a bet" });
    setBusy(true);
    try {
      const res = await api.bookSlip(live.map((s) => legOf(s.outcomeId)));
      setMsg(null);
      setCodeCard({ kind: "booking", codes: [{ code: res.code, count: live.length, odds: total }] });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : "Couldn't book this slip" });
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    if (!code.trim() || busy) return setMsg({ tone: "info", text: "Enter a booking code to load a slip" });
    setBusy(true);
    setLoadingCode(true);
    setMsg(null);
    setCodeCard(null);
    try {
      const res = await api.loadSlip(code.trim());
      replaceAll(res.available.map(toSelection));
      setChanged(false);
      const gone = res.unavailable.length;
      setMsg({
        tone: res.available.length ? "ok" : "warn",
        text: res.available.length
          ? `Loaded ${res.available.length} selection${res.available.length === 1 ? "" : "s"}${gone ? ` · ${gone} no longer available` : ""}`
          : "Those matches can't be bet on any more",
      });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : "Couldn't load that code" });
    } finally {
      setBusy(false);
      setLoadingCode(false);
    }
  }

  const segBtn = (on: boolean): CSSProperties => ({
    height: 30, padding: "0 12px", borderRadius: 6, border: "none", background: on ? "var(--tc-track)" : "transparent",
    color: on ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 13, fontWeight: 700,
  });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: inSheet ? "4px 16px 12px" : onBack ? "10px 16px 12px 4px" : "16px 16px 12px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: onBack ? 20 : 17, fontWeight: 800 }}>
          {onBack && (
            <button type="button" aria-label="Back" onClick={onBack} style={{ width: 44, height: 44, marginRight: -4, border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={20} />
            </button>
          )}
          Bet slip{" "}
          <span style={{ minWidth: 24, height: 24, padding: "0 6px", boxSizing: "border-box", borderRadius: 12, background: ACCENT, color: ON_ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{count}</span>
        </span>
        <div style={{ display: "flex", padding: 3, background: "var(--tc-page)", borderRadius: 8 }}>
          <button onClick={() => setMode("multiple")} style={segBtn(mode === "multiple")}>Multiple</button>
          <button onClick={() => setMode("single")} style={segBtn(mode === "single")}>Single</button>
        </div>
      </div>
      {codeCard && <CodeCard data={codeCard} onClose={() => setCodeCard(null)} onViewBets={() => navigate("/my-bets")} />}
      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
        <label style={{ flex: 1, minWidth: 0, height: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 10, border: "1px solid var(--tc-outline)", background: "var(--tc-page)", boxSizing: "border-box" }}>
          <span style={hidden}>Booking code</span>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Enter booking code" autoCapitalize="characters" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 16, letterSpacing: 0.5 }} />
        </label>
        <button onClick={load} disabled={busy} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT_TEXT, fontSize: 14, fontWeight: 800 }}>Load</button>
      </div>
      {/* Loading a booking code: the 1 X 2 loader (one full pass) in place of the selections. */}
      {showCodeLoader && <div style={{ borderTop: "1px solid var(--tc-line)" }}><Loader label="Loading slip…" compact /></div>}
      <div style={{ display: count || showCodeLoader ? "none" : "block", padding: "28px 16px", textAlign: "center", fontSize: 14, color: "var(--tc-label)", borderTop: "1px solid var(--tc-line)" }}>Tap any odds to add a selection</div>
      {!showCodeLoader && selections.map((s) => (
        <div key={s.outcomeId} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--tc-line)" }}>
          <button aria-label={`Remove ${s.eventLabel} ${s.marketName} · ${s.label}`} onClick={() => removeSelection(s.outcomeId)} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 14, border: "1px solid var(--tc-outline)", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={12} width={2.6} />
          </button>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, opacity: s.unavailable ? 0.5 : 1 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{s.marketName} · {s.label}</span>
            <span style={{ fontSize: 12, color: "var(--tc-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.eventLabel}</span>
          </div>
          {s.unavailable
            ? <span style={{ fontSize: 12, fontWeight: 800, color: "#E5484D", paddingTop: 4 }}>Unavailable</span>
            : <span style={{ fontFamily: NUM_FONT, fontSize: 20, fontWeight: 700 }}>{s.odds.toFixed(2)}</span>}
        </div>
      ))}
      <div style={{
        display: "flex", flexDirection: "column", gap: 12, padding: 16, borderTop: "1px solid var(--tc-line)", background: "var(--tc-panel-2)",
        ...(onBack ? { paddingBottom: "calc(16px + env(safe-area-inset-bottom))" } : {}),
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>{mode === "single" && count > 1 ? "Stake per bet" : "Stake"}</span>
          <label style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderRadius: 10, border: "1px solid var(--tc-outline)", background: "var(--tc-page)" }}>
            <span style={{ color: "var(--tc-label)", fontWeight: 700 }}>₦</span>
            <span style={hidden}>Stake</span>
            <input inputMode="numeric" value={stake.toLocaleString("en-US")} onChange={(e) => setStake(Number(e.target.value.replace(/\D/g, "")) || 0)} style={{ width: "60%", textAlign: "right", background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 16, fontWeight: 800 }} />
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[100, 500, 1000, 5000].map((v) => (
              <button key={v} onClick={() => setStake(v)} style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--tc-outline)", background: v === stake ? "var(--tc-text)" : "transparent", color: v === stake ? ON_ACCENT : "var(--tc-text)", fontSize: 12, fontWeight: 700 }}>
                ₦{v.toLocaleString("en-US")}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--tc-soft)" }}>
          <span>Total odds</span>
          <span style={{ fontWeight: 800, color: "var(--tc-text)" }}>{live.length && mode === "multiple" ? total.toFixed(2) : "—"}</span>
        </div>
        {mode === "single" && count > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "var(--tc-soft)" }}>
            <span>Total stake ({count} bets)</span>
            <span style={{ fontWeight: 800, color: "var(--tc-text)" }}>{naira(totalStake)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, color: "var(--tc-soft)" }}>Potential win</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT_TEXT }}>{live.length ? naira(win) : "—"}</span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--tc-soft)", cursor: "pointer" }}>
          <input type="checkbox" checked={anyOdds} onChange={(e) => toggleAnyOdds(e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT, margin: 0 }} />
          Accept any odds changes
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={book} disabled={busy} style={{ flex: 1, height: 52, borderRadius: 12, border: "1px solid var(--tc-outline-strong)", background: "transparent", color: "var(--tc-text)", fontSize: 15, fontWeight: 800 }}>Book bet</button>
          <button onClick={place} disabled={busy} style={{ flex: 2, height: 52, borderRadius: 12, border: "none", background: ACCENT, color: ON_ACCENT, fontSize: 16, fontWeight: 800, opacity: busy ? 0.7 : 1 }}>
            {!isAuthenticated ? "Login to place bet" : busy ? "Placing…" : changed ? "Accept odds & place" : "Place bet"}
          </button>
        </div>
        <span role="status" style={{ fontSize: 12, lineHeight: 1.4, color: msg ? TONE[msg.tone] : "var(--tc-label)", textAlign: "center" }}>
          {msg?.text ?? (anyOdds ? "Odds changes are accepted automatically" : "Higher odds are accepted automatically; we'll ask about lower ones")}
        </span>
      </div>
    </>
  );
}

export function CheckBet() {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function check() {
    const q = id.trim();
    if (!q) return;
    try {
      const { bet } = await api.checkTicket(q);
      const outcome = bet.status === "PENDING" ? "Open" : bet.status.charAt(0) + bet.status.slice(1).toLowerCase();
      setMsg(`${bet.ticket} · ${outcome} · ${bet.type === "ACCUMULATOR" ? `${bet.selections.length}-fold` : "Single"} · stake ${naira(bet.stake)} · to win ${naira(bet.potentialPayout)}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Couldn't check that bet");
    }
  }

  return (
    <section aria-label="Check a bet" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "var(--tc-panel)", border: "1px solid var(--tc-line)", borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800 }}><ReceiptIcon size={18} />Check a bet</div>
      <span style={{ fontSize: 12, color: msg ? "var(--tc-text)" : "var(--tc-label)" }}>{msg ?? "See the status of any ticket, even without logging in"}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1, minWidth: 0, height: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 10, border: "1px solid var(--tc-outline)", background: "var(--tc-page)", boxSizing: "border-box" }}>
          <span style={hidden}>Ticket ID</span>
          <input type="text" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && check()} placeholder="Ticket ID, e.g. PB4AGTNX" autoCapitalize="characters" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 16 }} />
        </label>
        <button onClick={check} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "var(--tc-track)", color: "var(--tc-text)", fontSize: 14, fontWeight: 800 }}>Check</button>
      </div>
    </section>
  );
}


// Small "demo data" tag shown while the backend serves simulated games.
// Hidden for now: uncomment the <span> (and remove `return null`) to show it again next to the logo.
export function DemoTag() {
  return null;
  // return (
  //   <span style={{ padding: "1px 6px", borderRadius: 4, background: ACCENT, color: ON_ACCENT, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>DEMO</span>
  // );
}

// ---------- one match, every market ----------
// Opened from "+N markets" on a match: all markets for that match, each odd tappable into the slip.
export function MatchMarketsSheet({ m, onClose }: { m: TCMatch; onClose: () => void }) {
  const { isOn, pick } = usePicker();
  const all = deriveOdds(m.o, m.ou);
  const markets = [...MK, CORRECT_SCORE];
  const team = (name: string, logo: string) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <Crest name={name} url={logo} size={36} />
      <span style={{ fontSize: 14, fontWeight: 800, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
    </div>
  );
  return (
    <Sheet label={`${m.home} vs ${m.away} markets`} onClose={onClose}>
      <SheetTitle title="All markets" onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Flag country={m.country} size={14} />{m.country ? `${m.country} · ` : ""}{m.league}</span>
          {m.live
            ? <span style={{ color: m.clock === "HT" ? "var(--tc-muted)" : "#E5484D", fontWeight: 800 }}>{m.clock}</span>
            : <span style={{ color: "var(--tc-soft)", fontWeight: 800 }}>{dayLabel(m.start)} {hhmm(m.start)}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {team(m.home, m.homeLogo)}
          <span style={{ fontFamily: NUM_FONT, fontSize: m.live ? 32 : 14, fontWeight: 700, color: m.live ? "var(--tc-text)" : "var(--tc-faint)" }}>
            {m.live ? `${m.hs} – ${m.as}` : "VS"}
          </span>
          {team(m.away, m.awayLogo)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 20px 24px", borderTop: "1px solid var(--tc-line)" }}>
        {markets.map((mk) => (
          <div key={mk.id} style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{mk.label}</span>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(mk.cols.length, 3)}, minmax(0, 1fr))`, gap: 6 }}>
              {mk.cols.map((c, i) => {
                const v = all[mk.id]?.[i] ?? 0;
                const id = `${m.id}|${mk.id}|${c}`;
                const on = isOn(id);
                return (
                  <button key={c} className="tc-odd-btn" disabled={!v} aria-label={v ? `${on ? "Remove" : "Add"} ${mk.label} ${c} at ${v.toFixed(2)}` : `${mk.label} ${c} suspended`}
                    onClick={() => v && pick(m, mk.id, mk.label, c, v)} style={{
                      height: 48, borderRadius: "var(--tc-odd-radius)", border: v ? "var(--tc-odd-border)" : "none", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0 12px", gap: 8, background: !v ? "var(--tc-panel)" : on ? "var(--tc-sel)" : "var(--tc-odd)", color: !v ? "var(--tc-faint)" : on ? "var(--tc-sel-text)" : "var(--tc-odd-text)",
                    }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: !v ? "var(--tc-faint)" : on ? "var(--tc-sel-text)" : "var(--tc-muted)", whiteSpace: "nowrap" }}>{c}</span>
                    {v ? <span style={{ fontFamily: NUM_FONT, fontSize: 19, fontWeight: 700 }}>{v.toFixed(2)}</span> : <LockIcon size={15} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// Theme button: tap = cycle A -> B -> C, hold ~0.8s = classic layout (Theme D).
export function useThemeButton() {
  const { cycleTheme, setTheme } = useTheme();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const start = () => {
    held.current = false;
    if (!THEMES.includes("d")) return;
    timer.current = setTimeout(() => { held.current = true; setTheme("d"); }, 800);
  };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => { if (!held.current) cycleTheme(); },
    title: THEMES.includes("d") ? "Tap to switch theme — hold for the classic layout" : "Tap to switch theme",
  };
}
