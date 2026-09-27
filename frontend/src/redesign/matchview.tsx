// Match view for live matches (match page): an attack-momentum graph with goals, cards and corners
// on it, and a pitch showing what's happening now (attack, dangerous attack, ball safe, corner,
// goal) or the half-time score. Built from the feed's per-minute momentum and events; the pitch
// moves between plausible positions every few seconds (it's a picture of the play, not tracking).
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ChatMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { type TCMatch, teamCode } from "./data";
import { ChanceAndPicks, LiveStats, Timeline } from "./matchstats";
import { ACCENT } from "./shared";

const HOME = ACCENT;
const AWAY = "#4C9EEB";
const QUOTE = "#2AB572"; // reply quote bar in chat
const card: CSSProperties = { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, overflow: "hidden" };

type Panel = "pitch" | "stats" | "timeline" | "commentary" | "lineups";
const JERSEY = <path d="M8.5 3.5 4 5.5 2.5 10l3 1.2V20.5h13v-9.3l3-1.2L20 5.5l-4.5-2a3.6 3.6 0 0 1-7 0z" />;
const CHAT_ICON = <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />;
const ic = (d: ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const PANELS: { id: Panel; label: string; icon: ReactNode }[] = [
  { id: "pitch", label: "Match view", icon: ic(<><rect x="2.5" y="5" width="19" height="14" rx="1.5" /><path d="M12 5v14" /><circle cx="12" cy="12" r="2.6" /><path d="M2.5 9.5h3v5h-3M21.5 9.5h-3v5h3" /></>) },
  { id: "stats", label: "Stats", icon: ic(<path d="M5 20V11M12 20V5M19 20v-6M3 20h18" />) },
  { id: "timeline", label: "Timeline", icon: ic(<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />) },
  { id: "commentary", label: "Commentary", icon: ic(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>) },
  { id: "lineups", label: "Line-ups", icon: ic(JERSEY) },
];

export function MatchView({ m }: { m: TCMatch }) {
  const [panel, setPanel] = useState<Panel>("pitch");
  return (
    <section aria-label="Match view" style={card}>
      {/* Capped width so it stays a sensible size in the wide desktop column. */}
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <MomentumGraph m={m} />
        {panel === "pitch" && <LivePitch m={m} />}
        <div role="tablist" aria-label="Match view" style={{ display: "flex", margin: "0 12px", borderBottom: "1px solid var(--tc-line)" }}>
          {PANELS.map((p) => (
            <button key={p.id} role="tab" aria-selected={panel === p.id} aria-label={p.label} title={p.label} onClick={() => setPanel(p.id)} style={{
              flex: 1, height: 46, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              color: panel === p.id ? "var(--tc-text)" : "var(--tc-label)", borderBottom: `2px solid ${panel === p.id ? ACCENT : "transparent"}`,
            }}>{p.icon}</button>
          ))}
        </div>
        <div style={{ padding: panel === "pitch" ? 0 : "14px 12px 12px" }}>
          {panel === "stats" && <><LiveStats m={m} /><ChanceAndPicks m={m} /></>}
          {panel === "timeline" && <Timeline m={m} />}
          {panel === "commentary" && <Commentary m={m} />}
          {panel === "lineups" && <Lineups m={m} />}
        </div>
      </div>
    </section>
  );
}

// ---------- commentary: written from the match events ----------
function Commentary({ m }: { m: TCMatch }) {
  const minute = m.momentum.length;
  const name = (side: "home" | "away") => (side === "home" ? m.home : m.away);
  const lines: { minute: number; text: string; strong?: boolean }[] = [{ minute: 0, text: `Kick-off! ${m.home} v ${m.away} is under way.` }];
  let hs = 0, as = 0;
  let halfDone = false;
  const half = () => {
    if (halfDone || (minute < 45 && m.clock !== "HT")) return;
    halfDone = true;
    lines.push({ minute: 45, text: `Half time: ${m.home} ${hs}–${as} ${m.away}.`, strong: true });
    if (m.clock !== "HT" && minute > 45) lines.push({ minute: 46, text: "The second half is under way." });
  };
  for (const e of [...(m.events ?? [])].sort((a, b) => a.minute - b.minute)) {
    if (e.minute > 45) half();
    if (e.type === "goal") {
      if (e.side === "home") hs++; else as++;
      lines.push({ minute: e.minute, text: `GOAL! ${name(e.side)} score. ${m.home} ${hs}–${as} ${m.away}.`, strong: true });
    } else if (e.type === "red") lines.push({ minute: e.minute, text: `Red card! ${name(e.side)} are down to ten men.`, strong: true });
    else if (e.type === "yellow") lines.push({ minute: e.minute, text: `Yellow card for ${name(e.side)}.` });
    else lines.push({ minute: e.minute, text: `Corner to ${name(e.side)}.` });
  }
  half();
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", maxHeight: 340, overflowY: "auto" }}>
      {lines.reverse().map((l, i) => (
        <li key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: i ? "1px solid var(--tc-line)" : "none" }}>
          <span style={{ width: 32, flexShrink: 0, fontSize: 13, fontWeight: 800, color: "var(--tc-soft)" }}>{l.minute}'</span>
          <span style={{ flex: 1, fontSize: 14, fontWeight: l.strong ? 800 : 500, color: l.strong ? "var(--tc-text)" : "var(--tc-soft)" }}>{l.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ---------- line-ups ----------
// Needs official team sheets from a data provider; until then say so rather than invent players.
function Lineups({ m }: { m: TCMatch }) {
  const side = (name: string, color: string) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">{JERSEY}</svg>
      <span style={{ maxWidth: "100%", fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "6px 0" }}>
      <div style={{ display: "flex", gap: 12 }}>{side(m.home, HOME)}{side(m.away, AWAY)}</div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--tc-label)", textAlign: "center" }}>Line-ups aren't available for this match yet.</p>
    </div>
  );
}

// ---------- live chat: its own card under the match view (like Bet9ja) ----------
export function LiveChat({ m }: { m: TCMatch }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-label="Live chat" style={{ ...card, padding: 12 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: open ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Live chat</span>
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{
            height: 36, padding: "0 14px 0 6px", borderRadius: 18, border: "none", background: ACCENT, color: "#13171C",
            display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, flexShrink: 0,
          }}>
            <span style={{ width: 26, height: 26, borderRadius: 13, background: "#13171C", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{CHAT_ICON}</svg>
            </span>
            {open ? "Close chat" : "Open chat"}
          </button>
        </div>
        {open && <ChatPanel m={m} />}
      </div>
    </section>
  );
}

// ---------- chat ----------
// Everyone reads; logged-in players post. New messages are fetched every few seconds while the
// chat is open and the tab is visible.
function ChatPanel({ m }: { m: TCMatch }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const last = useRef<string | undefined>(undefined);

  const add = (more: ChatMessage[]) => {
    if (!more.length) return;
    last.current = more[more.length - 1].at;
    setMessages((cur) => {
      const seen = new Set((cur ?? []).map((x) => x.id));
      return [...(cur ?? []), ...more.filter((x) => !seen.has(x.id))].slice(-200);
    });
  };
  useEffect(() => {
    let live = true;
    last.current = undefined;
    setMessages(null);
    api.getChat(m.id).then((r) => { if (live) { setMessages([]); add(r.messages); } }).catch(() => live && setMessages([]));
    const id = setInterval(() => {
      if (document.hidden) return;
      api.getChat(m.id, last.current).then((r) => live && add(r.messages)).catch(() => {});
    }, 4000);
    return () => { live = false; clearInterval(id); };
  }, [m.id]);
  // Keep the newest message in view.
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [messages?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setError("");
    try { add([await api.sendChat(m.id, t, replyTo?.id)]); setText(""); setReplyTo(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Couldn't send"); }
    finally { setSending(false); }
  };
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const reply = (x: ChatMessage) => { setReplyTo(x); input.current?.focus(); };
  const clip: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div ref={list} aria-live="polite" style={{ height: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "4px 2px" }}>
        {messages === null ? <p style={{ margin: "auto", fontSize: 13, color: "var(--tc-label)" }}>Loading chat…</p>
          : !messages.length ? <p style={{ margin: "auto", fontSize: 13, color: "var(--tc-label)", textAlign: "center" }}>No messages yet. Say something about the match!</p>
          : messages.map((x) => (
            // Bubble: masked name, the quoted message (if a reply), the text; time and Reply under it.
            <div key={x.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div style={{ maxWidth: "88%", padding: "9px 13px 10px", borderRadius: 16, background: "var(--tc-raise)", display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--tc-soft)" }}>{x.name}</span>
                {x.reply && (
                  <div style={{ borderLeft: `3px solid ${QUOTE}`, borderRadius: 6, background: "var(--tc-page)", padding: "5px 9px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: QUOTE }}>↩ {x.reply.name}</span>
                    <span style={{ ...clip, paddingRight: 2, fontSize: 13, color: "var(--tc-label)", fontStyle: x.reply.text === null ? "italic" : "normal" }}>{x.reply.text ?? "Message removed"}</span>
                  </div>
                )}
                <span style={{ fontSize: 14, lineHeight: 1.4, wordBreak: "break-word" }}>{x.text}</span>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 6, fontSize: 11.5, color: "var(--tc-label)" }}>
                {time(x.at)}
                {isAuthenticated && <button onClick={() => reply(x)} style={{ border: "none", background: "transparent", padding: "2px 0", color: "var(--tc-soft)", fontSize: 12, fontWeight: 800 }}>Reply</button>}
              </span>
            </div>
          ))}
      </div>
      {isAuthenticated && replyTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: `3px solid ${QUOTE}`, borderRadius: 6, background: "var(--tc-page)", padding: "6px 6px 6px 10px" }}>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: QUOTE }}>Replying to {replyTo.name}</span>
            <span style={{ ...clip, fontSize: 13, color: "var(--tc-label)" }}>{replyTo.text}</span>
          </span>
          <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" style={{ width: 32, height: 32, border: "none", background: "transparent", color: "var(--tc-label)", fontSize: 18, flexShrink: 0 }}>×</button>
        </div>
      )}
      {isAuthenticated ? (
        <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Say something…" aria-label="Chat message"
            style={{ flex: 1, minWidth: 0, height: 42, padding: "0 12px", borderRadius: 10, border: "1px solid var(--tc-outline)", background: "var(--tc-page)", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 16, outline: "none" }} />
          <button disabled={sending || !text.trim()} style={{ height: 42, padding: "0 16px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontWeight: 800, fontSize: 14, opacity: sending || !text.trim() ? 0.6 : 1 }}>Send</button>
        </form>
      ) : (
        <button onClick={() => navigate("/login")} style={{ height: 42, borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontWeight: 800, fontSize: 14 }}>Log in to chat</button>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#E5484D" }}>{error}</p>}
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--tc-label)" }}>Be respectful. No links or phone numbers. Poccabet staff will never ask for your password or money in chat.</p>
    </div>
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
