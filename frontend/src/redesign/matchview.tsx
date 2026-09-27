// Match view for live matches (match page): an attack-momentum graph with goals, cards and corners
// on it, and a pitch showing what's happening now (attack, dangerous attack, ball safe, corner,
// goal) or the half-time score. Built from the feed's per-minute momentum and events; the pitch
// moves between plausible positions every few seconds (it's a picture of the play, not tracking).
import { useEffect, useState, type CSSProperties } from "react";
import { type TCMatch, teamCode } from "./data";
import { ACCENT } from "./shared";

const HOME = ACCENT;
const AWAY = "#4C9EEB";
const card: CSSProperties = { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, overflow: "hidden" };

export function MatchView({ m }: { m: TCMatch }) {
  return (
    <section aria-label="Match view" style={card}>
      {/* Capped width so it stays a sensible size in the wide desktop column. */}
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <MomentumGraph m={m} />
        <LivePitch m={m} />
      </div>
    </section>
  );
}

// ---------- momentum graph ----------
function MomentumGraph({ m }: { m: TCMatch }) {
  const W = 360, H = 118, left = 34, right = 352, mid = 59, amp = 30;
  const x = (minute: number) => left + ((right - left) * Math.min(minute, 90)) / 90;
  const pts = m.momentum.map((v, i) => [x(i + 1), mid - v * amp] as const);
  const line = pts.length ? `M${x(0)},${mid} ` + pts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(" ") : "";
  const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${mid} Z` : "";
  const now = m.momentum.length;
  const events = m.events ?? [];
  const icon = (e: TCMatch["events"][number], i: number) => {
    const cx = x(e.minute), cy = e.side === "home" ? 12 : H - 12;
    if (e.type === "goal") return <g key={i}><circle cx={cx} cy={cy} r={5} fill="#fff" stroke="#13171C" strokeWidth={1.2} /><circle cx={cx} cy={cy} r={1.6} fill="#13171C" /></g>;
    if (e.type === "red" || e.type === "yellow") return <rect key={i} x={cx - 3} y={cy - 4.5} width={6} height={9} rx={1} fill={e.type === "red" ? "#E5484D" : "#F5C518"} />;
    return <circle key={i} cx={cx} cy={cy} r={3.2} fill="none" stroke={e.side === "home" ? HOME : AWAY} strokeWidth={1.4} />;
  };
  const label = `Attack momentum. ${events.filter((e) => e.type === "goal").map((e) => `Goal ${e.side === "home" ? m.home : m.away} ${e.minute}'`).join(", ") || "No goals yet"}.`;
  return (
    <div style={{ padding: "12px 12px 4px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
        <defs>
          <clipPath id="mv-top"><rect x={0} y={0} width={W} height={mid} /></clipPath>
          <clipPath id="mv-bottom"><rect x={0} y={mid} width={W} height={H - mid} /></clipPath>
        </defs>
        {/* halves and quarter-hour guides */}
        {[15, 30, 60, 75].map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={20} y2={H - 20} stroke="var(--tc-line)" strokeWidth={1} />)}
        <rect x={x(45) - 3} y={20} width={6} height={H - 40} fill="var(--tc-line)" opacity={0.7} />
        <line x1={left} x2={right} y1={mid} y2={mid} stroke="var(--tc-outline-strong)" strokeWidth={1} />
        {area && <>
          <path d={area} fill={HOME} opacity={0.28} clipPath="url(#mv-top)" />
          <path d={area} fill={AWAY} opacity={0.28} clipPath="url(#mv-bottom)" />
          <path d={line} fill="none" stroke="var(--tc-soft)" strokeWidth={1.4} strokeLinejoin="round" />
        </>}
        {now > 0 && now < 90 && <line x1={x(now)} x2={x(now)} y1={20} y2={H - 20} stroke="#E5484D" strokeWidth={1.2} strokeDasharray="3 3" />}
        {events.map(icon)}
        <text x={2} y={16} fill={HOME} fontSize={10} fontWeight={800}>{teamCode(m.home)}</text>
        <text x={2} y={H - 8} fill={AWAY} fontSize={10} fontWeight={800}>{teamCode(m.away)}</text>
      </svg>
      <div style={{ position: "relative", height: 14, margin: `0 ${((W - right) / W) * 100}% 0 ${(left / W) * 100}%`, fontSize: 10, fontWeight: 600, color: "var(--tc-label)" }}>
        {[[15, "15'"], [30, "30'"], [45, "HT"], [60, "60'"], [75, "75'"], [90, "FT"]].map(([t, l]) => (
          <span key={l} style={{ position: "absolute", left: `${((t as number) / 90) * 100}%`, transform: "translateX(-50%)" }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

// ---------- live pitch ----------
type Phase = { kind: "goal" | "corner" | "danger" | "attack" | "safe"; side: "home" | "away"; bx: number; by: number };

// A small deterministic random number for a given seed (so a given moment looks the same for everyone).
const seeded = (n: number) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };

function phaseAt(m: TCMatch, t: number): Phase {
  const minute = m.momentum.length;
  const recent = (type: string, within: number) => [...(m.events ?? [])].reverse().find((e) => e.type === type && minute - e.minute <= within);
  const goal = recent("goal", 1);
  const slot = Math.floor(t / 4000); // a new moment every 4 seconds
  const r = seeded(slot + minute * 1000 + m.id.length);
  const y = 0.2 + seeded(slot * 7 + 3) * 0.6;
  // Home attacks to the right, away to the left; x is 0..1 across the pitch.
  const toward = (side: "home" | "away", depth: number) => (side === "home" ? depth : 1 - depth);
  if (goal) return { kind: "goal", side: goal.side, bx: toward(goal.side, 0.95), by: 0.5 };
  const corner = recent("corner", 0);
  if (corner && r < 0.6) return { kind: "corner", side: corner.side, bx: toward(corner.side, 0.985), by: r < 0.3 ? 0.03 : 0.97 };
  const last = m.momentum.slice(-3);
  const avg = last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0;
  // The side on top has the ball more often; its intensity makes dangerous attacks likelier.
  const top: "home" | "away" = avg >= 0 ? "home" : "away";
  const other = top === "home" ? "away" : "home";
  const intensity = Math.min(1, Math.abs(avg) + 0.2);
  if (r < 0.35 * intensity) return { kind: "danger", side: top, bx: toward(top, 0.8 + seeded(slot + 11) * 0.12), by: y };
  if (r < 0.75) return { kind: "attack", side: r < 0.62 ? top : other, bx: toward(r < 0.62 ? top : other, 0.6 + seeded(slot + 5) * 0.15), by: y };
  return { kind: "safe", side: other, bx: toward(other, 0.25 + seeded(slot + 9) * 0.2), by: y };
}

const PHASE_LABEL: Record<Phase["kind"], string> = { goal: "GOAL!", corner: "Corner", danger: "Dangerous attack", attack: "Attack", safe: "Ball safe" };

function LivePitch({ m }: { m: TCMatch }) {
  // Moments depend on the time, so they only start once the page is running in the browser.
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    setT(Date.now());
    const id = setInterval(() => setT(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ht = m.clock === "HT";
  const p = t === null || ht ? null : phaseAt(m, t);
  const color = p ? (p.side === "home" ? HOME : AWAY) : "#fff";
  const team = p ? (p.side === "home" ? m.home : m.away) : "";
  const W = 360, H = 210;
  return (
    <div style={{ position: "relative", margin: "4px 12px 12px", borderRadius: 10, overflow: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" style={{ display: "block" }}>
        {Array.from({ length: 10 }, (_, i) => <rect key={i} x={(W / 10) * i} y={0} width={W / 10} height={H} fill={i % 2 ? "#2F7D32" : "#34873A"} />)}
        {/* the attacking side's half glows in its colour */}
        {p && p.kind !== "safe" && <rect x={p.side === "home" ? W / 2 : 0} y={0} width={W / 2} height={H} fill={color} opacity={p.kind === "attack" ? 0.12 : 0.22} />}
        <g fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.5}>
          <rect x={8} y={8} width={W - 16} height={H - 16} />
          <line x1={W / 2} x2={W / 2} y1={8} y2={H - 8} />
          <circle cx={W / 2} cy={H / 2} r={26} />
          <rect x={8} y={H / 2 - 48} width={48} height={96} /><rect x={8} y={H / 2 - 22} width={18} height={44} />
          <rect x={W - 56} y={H / 2 - 48} width={48} height={96} /><rect x={W - 26} y={H / 2 - 22} width={18} height={44} />
        </g>
        <circle cx={W / 2} cy={H / 2} r={2} fill="rgba(255,255,255,0.75)" />
        {p && (
          <g style={{ transition: "transform 1.2s ease-in-out", transform: `translate(${8 + p.bx * (W - 16)}px, ${8 + p.by * (H - 16)}px)` }}>
            <circle r={p.kind === "danger" || p.kind === "goal" ? 16 : 11} fill={color} opacity={0.35}>
              <animate attributeName="r" values={p.kind === "danger" || p.kind === "goal" ? "12;20;12" : "9;13;9"} dur="1.6s" repeatCount="indefinite" />
            </circle>
            <circle r={5} fill="#fff" stroke="#13171C" strokeWidth={1} />
          </g>
        )}
      </svg>
      {/* what's happening */}
      {p && (
        <div role="status" aria-live="polite" style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", maxWidth: "90%", padding: "6px 12px", borderRadius: 999, background: "rgba(8,12,15,0.72)", color: "#fff", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />{PHASE_LABEL[p.kind]} · {team}
        </div>
      )}
      {ht && (
        <div style={{ position: "absolute", inset: "16% 12%", borderRadius: 12, background: "rgba(8,12,15,0.62)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#fff" }}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Half time</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 700 }}>
            <span style={{ minWidth: 40, padding: "2px 10px", borderRadius: 8, background: "#fff", color: "#13171C", textAlign: "center" }}>{m.hs}</span>:
            <span style={{ minWidth: 40, padding: "2px 10px", borderRadius: 8, background: "#fff", color: "#13171C", textAlign: "center" }}>{m.as}</span>
          </span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{m.home} · {m.away}</span>
        </div>
      )}
    </div>
  );
}
