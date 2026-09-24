import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useBetSlip } from "../context/BetSlipContext";
import type { Dir, TCMatch } from "./data";
import { CheckIcon, CloseIcon, LockIcon, ReceiptIcon } from "./icons";
import { MK, SHEET_GROUPS } from "./markets";

export const ACCENT = "#F5C518";
export const WELCOME_BONUS_AMOUNT = "[AMOUNT]"; // TODO: real welcome-bonus amount
// One switch for the featured-match card at the top of the Live, Upcoming and Top leagues tabs.
export const SHOW_TAB_FEATURE = true;

export function useIsDesktop() {
  const query = "(min-width: 900px)";
  const [desk, setDesk] = useState(() => window.matchMedia(query).matches);
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
  const idle = variant === "home" ? "#262D36" : "#2E3A42";
  const lockedBg = variant === "desk" ? "#1E282E" : "#1B2429";
  const showArrow = !!dir && !locked && variant !== "home";
  return (
    <button
      className="tc-odd-btn"
      aria-label={locked ? `${aria} suspended` : `${on ? "Remove" : "Add"} ${aria} at ${value.toFixed(2)}${dir ? `, odds moving ${dir}` : ""}`}
      onClick={locked ? undefined : onPick}
      disabled={locked}
      style={{
        position: "relative", padding: 0, borderRadius: 8, border: "none",
        background: locked ? lockedBg : on ? ACCENT : idle,
        color: locked ? "#5E6A74" : on ? "#13171C" : "#F2F4F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
        ...style,
      }}
    >
      {locked && <LockIcon size={lockSize ?? (variant === "desk" ? 15 : 16)} />}
      {showArrow && (
        <span
          aria-hidden="true"
          className="tc-odds-trend"
          style={{
            top: dir === "down" ? "auto" : 4, right: dir === "down" ? "auto" : 4,
            bottom: dir === "down" ? 4 : "auto", left: dir === "down" ? 4 : "auto",
            background: on ? "#13171C" : dir === "up" ? "#2AB572" : "#E5484D",
            transform: dir === "down" ? "rotate(180deg)" : "none",
            animation: `odds-flash 7s linear ${((flash * 1.3) % 6).toFixed(1)}s infinite both`,
          }}
        />
      )}
      {!locked && <span style={{ position: "relative", zIndex: 1 }}>{value.toFixed(2)}</span>}
    </button>
  );
}

// ---------- bottom sheet (mobile) ----------
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(8,12,15,0.62)", zIndex: 60 }} />
      <div role="dialog" aria-label={label} style={{
        position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: "80vh", zIndex: 61, display: "flex", flexDirection: "column",
        background: "#1B2429", borderRadius: "18px 18px 0 0", boxShadow: "0 -12px 32px rgba(0,0,0,0.4)", overflowY: "auto",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <span style={{ width: 40, height: 4, borderRadius: 2, background: "#45525A" }} />
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
      <button aria-label="Close" onClick={onClose} style={{ width: 44, height: 44, border: "none", background: "transparent", color: "#A9B2BD", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CloseIcon />
      </button>
    </div>
  );
}

export function MarketsSheet({ active, onPick, onClose }: { active: string; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet label="All markets" onClose={onClose}>
      <SheetTitle title="All markets" onClose={onClose} />
      {SHEET_GROUPS.map((g) => (
        <div key={g} style={{ display: "flex", flexDirection: "column", padding: "4px 0 8px" }}>
          <span style={{ padding: "6px 20px", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "#8B95A1" }}>{g}</span>
          {MK.filter((m) => m.group === g).map((m) => {
            const on = m.id === active;
            return (
              <button key={m.id} onClick={() => onPick(m.id)} style={{
                height: 44, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: on ? "#222c32" : "transparent", border: "none", color: on ? ACCENT : "#F2F4F6",
                fontSize: 15, fontWeight: on ? 800 : 600, textAlign: "left",
              }}>
                {m.label}
                <CheckIcon style={{ display: on ? "block" : "none" }} />
              </button>
            );
          })}
        </div>
      ))}
    </Sheet>
  );
}

// ---------- bet slip (desktop rail; also the mobile bet-slip sheet) ----------
const hidden: CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };
const naira = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BetSlipBody({ inSheet = false }: { inSheet?: boolean }) {
  const { selections, removeSelection, clear } = useBetSlip();
  const { isAuthenticated, refreshBalance } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"multiple" | "single">("multiple");
  const [stake, setStake] = useState(1000);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const count = selections.length;
  const total = selections.reduce((a, s) => a * s.odds, 1);
  const win = mode === "multiple" ? stake * total : selections.reduce((a, s) => a + stake * s.odds, 0);

  async function place() {
    if (!isAuthenticated) return navigate("/login");
    if (!count || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "multiple") await api.placeBet({ stake, outcomeIds: selections.map((s) => s.outcomeId) });
      else for (const s of selections) await api.placeBet({ stake, outcomeIds: [s.outcomeId] });
      clear();
      await refreshBalance();
      setMsg("Bet placed");
    } catch (err: any) {
      setMsg(err.message ?? "Couldn't place the bet");
    } finally {
      setBusy(false);
    }
  }

  const segBtn = (on: boolean): CSSProperties => ({
    height: 30, padding: "0 12px", borderRadius: 6, border: "none", background: on ? "#33414A" : "transparent",
    color: on ? "#F2F4F6" : "#A9B2BD", fontSize: 13, fontWeight: 700,
  });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: inSheet ? "4px 16px 12px" : "16px 16px 12px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800 }}>
          Bet slip{" "}
          <span style={{ minWidth: 24, height: 24, padding: "0 6px", boxSizing: "border-box", borderRadius: 12, background: ACCENT, color: "#13171C", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{count}</span>
        </span>
        <div style={{ display: "flex", padding: 3, background: "#222c32", borderRadius: 8 }}>
          <button onClick={() => setMode("multiple")} style={segBtn(mode === "multiple")}>Multiple</button>
          <button onClick={() => setMode("single")} style={segBtn(mode === "single")}>Single</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
        <label style={{ flex: 1, minWidth: 0, height: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 10, border: "1px solid #3A474F", background: "#222c32", boxSizing: "border-box" }}>
          <span style={hidden}>Booking code</span>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter booking code" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#F2F4F6", fontFamily: "inherit", fontSize: 14, letterSpacing: 0.5 }} />
        </label>
        <button onClick={() => setMsg("Booking codes are coming soon")} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 800 }}>Load</button>
      </div>
      <div style={{ display: count ? "none" : "block", padding: "28px 16px", textAlign: "center", fontSize: 14, color: "#8B95A1", borderTop: "1px solid #2E3A41" }}>Tap any odds to add a selection</div>
      {selections.map((s) => (
        <div key={s.outcomeId} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderTop: "1px solid #2E3A41" }}>
          <button aria-label={`Remove ${s.eventLabel} ${s.marketName} · ${s.label}`} onClick={() => removeSelection(s.outcomeId)} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 14, border: "1px solid #3A474F", background: "transparent", color: "#A9B2BD", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={12} width={2.6} />
          </button>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{s.marketName} · {s.label}</span>
            <span style={{ fontSize: 12, color: "#8B95A1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.eventLabel}</span>
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>{s.odds.toFixed(2)}</span>
        </div>
      ))}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, borderTop: "1px solid #2E3A41", background: "#1E282E" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8B95A1" }}>Stake</span>
          <label style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderRadius: 10, border: "1px solid #3A474F", background: "#222c32" }}>
            <span style={{ color: "#8B95A1", fontWeight: 700 }}>₦</span>
            <span style={hidden}>Stake</span>
            <input inputMode="numeric" value={stake.toLocaleString("en-US")} onChange={(e) => setStake(Number(e.target.value.replace(/\D/g, "")) || 0)} style={{ width: "60%", textAlign: "right", background: "transparent", border: "none", outline: "none", color: "#F2F4F6", fontFamily: "inherit", fontSize: 16, fontWeight: 800 }} />
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {[100, 500, 1000, 5000].map((v) => (
              <button key={v} onClick={() => setStake(v)} style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid #3A474F", background: v === stake ? "#F2F4F6" : "transparent", color: v === stake ? "#13171C" : "#F2F4F6", fontSize: 12, fontWeight: 700 }}>
                ₦{v.toLocaleString("en-US")}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#C3CBD3" }}>
          <span>Total odds</span>
          <span style={{ fontWeight: 800, color: "#F2F4F6" }}>{count && mode === "multiple" ? total.toFixed(2) : "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 14, color: "#C3CBD3" }}>Potential win</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{count ? naira(win) : "—"}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMsg("Booking codes are coming soon")} style={{ flex: 1, height: 52, borderRadius: 12, border: "1px solid #45525A", background: "transparent", color: "#F2F4F6", fontSize: 15, fontWeight: 800 }}>Book bet</button>
          <button onClick={place} disabled={busy} style={{ flex: 2, height: 52, borderRadius: 12, border: "none", background: ACCENT, color: "#13171C", fontSize: 16, fontWeight: 800 }}>
            {!isAuthenticated ? "Login to place bet" : busy ? "Placing…" : "Place bet"}
          </button>
        </div>
        <span role="status" style={{ fontSize: 12, lineHeight: 1.4, color: msg ? "#F2F4F6" : "#8B95A1", textAlign: "center" }}>
          {msg ?? "Book bet gives you a code to share or load later"}
        </span>
      </div>
    </>
  );
}

export function CheckBet() {
  const { isAuthenticated } = useAuth();
  const [id, setId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function check() {
    const q = id.trim();
    if (!q) return;
    if (!isAuthenticated) return setMsg("Log in to check your bets — public ticket lookup is coming soon");
    try {
      const { bets } = await api.getMyBets();
      const bet = bets.find((b: any) => String(b.id).startsWith(q));
      setMsg(bet ? `${bet.status} · stake ₦${Number(bet.stake).toLocaleString("en-US")}` : "No bet found with that ID");
    } catch (err: any) {
      setMsg(err.message ?? "Couldn't check that bet");
    }
  }

  return (
    <section aria-label="Check a bet" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "#1B2429", border: "1px solid #2E3A41", borderRadius: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800 }}><ReceiptIcon size={18} />Check a bet</div>
      <span style={{ fontSize: 12, color: msg ? "#F2F4F6" : "#8B95A1" }}>{msg ?? "See the status of any ticket, even without logging in"}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1, minWidth: 0, height: 40, display: "flex", alignItems: "center", padding: "0 12px", borderRadius: 10, border: "1px solid #3A474F", background: "#222c32", boxSizing: "border-box" }}>
          <span style={hidden}>Bet ID</span>
          <input type="text" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && check()} placeholder="Enter bet ID" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "#F2F4F6", fontFamily: "inherit", fontSize: 14 }} />
        </label>
        <button onClick={check} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: "#33414A", color: "#F2F4F6", fontSize: 14, fontWeight: 800 }}>Check</button>
      </div>
    </section>
  );
}

export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { user, balance, logout } = useAuth();
  return (
    <Sheet label="Account" onClose={onClose}>
      <SheetTitle title={user?.displayName ?? "Account"} onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#C3CBD3" }}>
          <span>Balance</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{naira(balance)}</span>
        </div>
        <button onClick={() => { logout(); onClose(); }} style={{ height: 48, borderRadius: 10, border: "1px solid #2E3640", background: "transparent", color: "#F2F4F6", fontSize: 15, fontWeight: 700 }}>Log out</button>
      </div>
    </Sheet>
  );
}

// Small "demo data" tag shown while the backend serves simulated games.
export function DemoTag() {
  return (
    <span style={{ padding: "1px 6px", borderRadius: 4, background: ACCENT, color: "#13171C", fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>DEMO</span>
  );
}
