// Match view for live matches (match page): an attack-momentum graph with goals, cards and corners
// on it, and a pitch showing what's happening now (attack, dangerous attack, ball safe, corner,
// goal) or the half-time score. Built from the feed's per-minute momentum and events; the pitch
// moves between plausible positions every few seconds (it's a picture of the play, not tracking).
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ChatMessage, type Lineup, type MatchInfo } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { type TCMatch, teamCode } from "./data";
import { usePickShares } from "./matchstats";
import { impliedPct } from "./markets";
import { ACCENT } from "./shared";

const HOME = ACCENT;
const AWAY = "#4C9EEB";
const QUOTE = "#2AB572"; // reply quote bar in chat
const PITCH_W = 360, PITCH_H = 220; // match view box (pitch and every tab)
const card: CSSProperties = { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, overflow: "hidden" };
// flat: full screen width on phones (see matchpage.tsx), cancelling the page's 16px side padding.
const shell = (flat?: boolean): CSSProperties => flat
  ? { background: "var(--tc-card)", margin: "0 -16px", overflow: "hidden" }
  : card;

type Panel = "pitch" | "stats" | "h2h" | "table" | "timeline" | "lineups";
const JERSEY = <path d="M8.5 3.5 4 5.5 2.5 10l3 1.2V20.5h13v-9.3l3-1.2L20 5.5l-4.5-2a3.6 3.6 0 0 1-7 0z" />;
const CHAT_ICON = <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z" />;
const ic = (d: ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const PANELS: { id: Panel; label: string; icon: ReactNode }[] = [
  { id: "pitch", label: "Match view", icon: ic(<><rect x="2.5" y="5" width="19" height="14" rx="1.5" /><path d="M12 5v14" /><circle cx="12" cy="12" r="2.6" /><path d="M2.5 9.5h3v5h-3M21.5 9.5h-3v5h3" /></>) },
  { id: "stats", label: "Stats", icon: ic(<path d="M5 20V11M12 20V5M19 20v-6M3 20h18" />) },
  { id: "h2h", label: "Head to head", icon: ic(<><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M2.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M10.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /></>) },
  { id: "table", label: "Standings", icon: ic(<><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></>) },
  { id: "timeline", label: "Timeline", icon: ic(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>) },
  { id: "lineups", label: "Line-ups", icon: ic(JERSEY) },
];

export function MatchView({ m, flat }: { m: TCMatch; flat?: boolean }) {
  const [panel, setPanel] = useState<Panel>("pitch");
  const info = useMatchInfo(m.id);
  return (
    <section aria-label="Match view" style={shell(flat)}>
      {/* Capped width so it stays a sensible size in the wide desktop column. */}
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <MomentumGraph m={m} />
        {/* Every tab opens in the same pitch-sized box, so switching tabs doesn't move the page. */}
        <div role="tabpanel" style={{ position: "relative", margin: "4px 12px 12px", aspectRatio: `${PITCH_W} / ${PITCH_H}`, borderRadius: 10, overflow: "hidden" }}>
          {panel === "pitch" ? <LivePitch m={m} /> : (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "0 2px 4px" }}>
              {panel === "stats" && <StatsPager m={m} />}
              {panel === "h2h" && <HeadToHead m={m} info={info} />}
              {panel === "table" && <Standings m={m} info={info} />}
              {panel === "timeline" && <MatchTimeline m={m} />}
              {panel === "lineups" && <Lineups m={m} info={info} />}
            </div>
          )}
        </div>
        <div role="tablist" aria-label="Match view" style={{ display: "flex", margin: "0 12px 4px", borderBottom: "1px solid var(--tc-line)" }}>
          {PANELS.map((p) => (
            <button key={p.id} role="tab" aria-selected={panel === p.id} aria-label={p.label} title={p.label} onClick={() => setPanel(p.id)} style={{
              flex: 1, height: 46, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
              color: panel === p.id ? "var(--tc-text)" : "var(--tc-label)", borderBottom: `2px solid ${panel === p.id ? ACCENT : "transparent"}`,
            }}>{p.icon}</button>
          ))}
        </div>
      </div>
    </section>
  );
}

// Small caps heading at the top of a tab, with room for controls on the right.
function Head({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 24, marginBottom: 6, borderBottom: "1px solid var(--tc-line)" }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: "var(--tc-soft)" }}>{title}</span>
      {children}
    </div>
  );
}

// ---------- stats: compact pages, like BetKing (arrows or swipe) ----------
type Pair = [number, number];
function StatLine({ label, v, unit = "" }: { label: string; v: Pair; unit?: string }) {
  const [h, a] = v;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{h}{unit}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--tc-label)", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{a}{unit}</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: 3 }}>
        {h + a === 0 ? <span style={{ flex: 1, borderRadius: 2, background: "var(--tc-track)" }} /> : <>
          {h > 0 && <span style={{ flex: h, borderRadius: 2, background: HOME }} />}
          {a > 0 && <span style={{ flex: a, borderRadius: 2, background: AWAY }} />}
        </>}
      </div>
    </div>
  );
}

// Three-way split (home / draw / away) on one line: home % left, away % right, draw in the label.
function SplitLine({ label, v }: { label: string; v: number[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{v[0]}%</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--tc-label)", whiteSpace: "nowrap" }}>{label} · Draw {v[1]}%</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{v[2]}%</span>
      </div>
      <div style={{ display: "flex", gap: 3, height: 3 }}>
        {[HOME, "var(--tc-outline-strong)", AWAY].map((c, i) => v[i] > 0 && <span key={i} style={{ flex: v[i], borderRadius: 2, background: c }} />)}
      </div>
    </div>
  );
}

function CardsLine({ m }: { m: TCMatch }) {
  const n = (side: "home" | "away", type: "yellow" | "red") => (m.events ?? []).filter((e) => e.side === side && e.type === type).length;
  const chip = (color: string) => <span aria-hidden="true" style={{ width: 9, height: 12, borderRadius: 2, background: color, display: "inline-block" }} />;
  const team = (side: "home" | "away") => (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 800 }}>
      {chip("#F5C518")}{n(side, "yellow")}<span style={{ width: 4 }} />{chip("#E5484D")}{n(side, "red")}
    </span>
  );
  return (
    <div aria-label={`Cards: ${m.home} ${n("home", "yellow")} yellow ${n("home", "red")} red, ${m.away} ${n("away", "yellow")} yellow ${n("away", "red")} red`}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      {team("home")}
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, color: "var(--tc-label)" }}>CARDS</span>
      {team("away")}
    </div>
  );
}

function StatsPager({ m }: { m: TCMatch }) {
  const picks = usePickShares(m.id);
  const st = m.stats;
  const pages: { title: string; body: ReactNode }[] = [];
  if (st) {
    pages.push({ title: "Statistics", body: <>
      <CardsLine m={m} />
      {st.onTarget && st.offTarget && st.blocked ? <>
        <StatLine label="Shots on target" v={st.onTarget} />
        <StatLine label="Shots off target" v={st.offTarget} />
        <StatLine label="Shots blocked" v={st.blocked} />
      </> : <StatLine label="Shots" v={st.shots} />}
      <StatLine label="Corner kicks" v={st.corners} />
    </> });
    pages.push({ title: "Attacks", body: <>
      <StatLine label="Possession" v={st.possession} unit="%" />
      {st.attacks && <StatLine label="Attacks" v={st.attacks} />}
      {st.dangerous && <StatLine label="Dangerous attacks" v={st.dangerous} />}
      <StatLine label="Total shots" v={st.shots} />
    </> });
  }
  if (picks) pages.push({ title: "Players' picks", body: <>
    <SplitLine label="Players picked" v={picks.shares} />
    <span style={{ fontSize: 11, color: "var(--tc-label)", textAlign: "center" }}>
      {m.home} left · {m.away} right · {picks.total.toLocaleString("en-US")} picks today
    </span>
  </> });
  if (!pages.length) return <><Head title="Statistics" /><p style={{ margin: 0, fontSize: 13, color: "var(--tc-label)" }}>No stats for this match yet.</p></>;
  return <Pager pages={pages} />;
}

// ---------- match info (head-to-head, table, line-ups), refreshed every minute ----------
type Info = MatchInfo | null;
function useMatchInfo(id: string): Info {
  const [info, setInfo] = useState<Info>(null);
  useEffect(() => {
    let live = true;
    const load = () => api.getMatchInfo(id).then((r) => live && setInfo(r)).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 60000);
    return () => { live = false; clearInterval(t); };
  }, [id]);
  return info;
}
const Note = ({ children }: { children: ReactNode }) => <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--tc-label)", textAlign: "center" }}>{children}</p>;
const caps: CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--tc-label)" };
const big = (color: string, size = 30): CSSProperties => ({ fontFamily: "'Barlow Condensed', sans-serif", fontSize: size, fontWeight: 700, lineHeight: 1, color });

// Paged box with ‹ 1/3 › (and swipe), shared by Stats-style tabs.
function Pager({ pages }: { pages: { title: string; body: ReactNode }[] }) {
  const [page, setPage] = useState(0);
  const touch = useRef<number | null>(null);
  const i = Math.min(page, pages.length - 1);
  const go = (d: number) => setPage((i + d + pages.length) % pages.length);
  const arrow = (d: number, label: string, path: string) => (
    <button onClick={() => go(d)} aria-label={label} style={{ width: 28, height: 24, border: "none", background: "transparent", color: "var(--tc-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
    </button>
  );
  return (
    <div onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x !== null && Math.abs(e.changedTouches[0].clientX - x) > 40) go(e.changedTouches[0].clientX < x ? 1 : -1); }}>
      <Head title={pages[i].title}>
        {pages.length > 1 && <span style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 700, color: "var(--tc-soft)" }}>
          {arrow(-1, "Previous", "m15 18-6-6 6-6")}{i + 1}/{pages.length}{arrow(1, "Next", "m9 18 6-6-6-6")}
        </span>}
      </Head>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>{pages[i].body}</div>
    </div>
  );
}

// Big three-way numbers over a split bar (win probability, previous meetings).
function ThreeWay({ caption, v, labels, pct }: { caption: string; v: number[]; labels: string[]; pct?: boolean }) {
  const unit = pct ? <span style={{ fontSize: "0.6em" }}>%</span> : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...caps, textAlign: "center" }}>{caption}</span>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}><span style={big(HOME)}>{v[0]}{unit}</span><span style={{ ...caps, color: HOME }}>{labels[0]}</span></span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><span style={big("var(--tc-muted)", 24)}>{v[1]}{unit}</span><span style={caps}>{labels[1]}</span></span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}><span style={big(AWAY)}>{v[2]}{unit}</span><span style={{ ...caps, color: AWAY }}>{labels[2]}</span></span>
      </div>
      <div style={{ display: "flex", gap: 4, height: 5 }}>
        {v[0] + v[1] + v[2] === 0 ? <span style={{ flex: 1, borderRadius: 3, background: "var(--tc-track)" }} />
          : [HOME, "var(--tc-outline-strong)", AWAY].map((c, k) => v[k] > 0 && <span key={k} style={{ flex: v[k], borderRadius: 3, background: c }} />)}
      </div>
    </div>
  );
}

const RESULT_BG = { W: "#2AB572", D: "var(--tc-outline-strong)", L: "#E5484D" } as const;
function HeadToHead({ m, info }: { m: TCMatch; info: Info }) {
  const codes = [teamCode(m.home), teamCode(m.away)];
  const pages: { title: string; body: ReactNode }[] = [];
  if (m.o[0] > 0) pages.push({ title: "Head to head", body: <ThreeWay caption="Win probability" v={impliedPct(m.o)} labels={[codes[0], "Draw", codes[1]]} pct /> });
  if (info?.available) {
    const r = info.meetings.map((x) => { const [f, a] = x.home === m.home ? [x.hg, x.ag] : [x.ag, x.hg]; return f > a ? 0 : f === a ? 1 : 2; });
    pages.push({ title: "Head to head", body: info.meetings.length ? <>
      <ThreeWay caption={`Last ${info.meetings.length} meeting${info.meetings.length === 1 ? "" : "s"}`} v={[0, 1, 2].map((k) => r.filter((x) => x === k).length)} labels={["Wins", "Draws", "Wins"]} />
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
        {info.meetings.map((x, k) => (
          <span key={k} title={`${x.home} ${x.hg}-${x.ag} ${x.away}`} style={{ padding: "3px 8px", borderRadius: 6, background: "var(--tc-raise)", fontSize: 12, fontWeight: 800 }}>
            {teamCode(x.home)} {x.hg}-{x.ag} {teamCode(x.away)}
          </span>
        ))}
      </div>
    </> : <Note>{m.home} and {m.away} haven't met in the last 30 days.</Note> });
    const row = (name: string, code: string, color: string, form: typeof info.form.home) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 40, fontSize: 13, fontWeight: 800, color }}>{code}</span>
        <span style={{ flex: 1, display: "flex", gap: 6 }} aria-label={`${name} last results: ${form.map((f) => f.result).join(" ") || "none"}`}>
          {form.length ? form.map((f, k) => (
            <span key={k} title={`${f.home} ${f.hg}-${f.ag} ${f.away}`} style={{ width: 26, height: 26, borderRadius: 6, background: RESULT_BG[f.result], color: f.result === "D" ? "var(--tc-text)" : "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{f.result}</span>
          )) : <span style={{ fontSize: 12, color: "var(--tc-label)" }}>No games yet</span>}
        </span>
      </div>
    );
    pages.push({ title: "Form", body: <>
      <span style={{ ...caps, textAlign: "center" }}>Last 5 matches · newest first</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
        {row(m.home, codes[0], HOME, info.form.home)}
        {row(m.away, codes[1], AWAY, info.form.away)}
      </div>
    </> });
  }
  if (!pages.length) return <><Head title="Head to head" /><Note>{info ? "Head-to-head isn't available for this match yet." : "Loading…"}</Note></>;
  return <Pager pages={pages} />;
}

// ---------- standings: this league's table, overall / home / away, with or without live scores ----------
function Standings({ m, info }: { m: TCMatch; info: Info }) {
  const [mode, setMode] = useState<"overall" | "home" | "away">("overall");
  const [withLive, setWithLive] = useState(false);
  if (!info?.available) return <><Head title="Standings" /><Note>{info ? "The table isn't available for this match yet." : "Loading…"}</Note></>;
  const t = info.table;
  const rows = new Map(t.teams.map((team) => [team, { team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 }]));
  const add = (team: string, f: number, a: number) => {
    const r = rows.get(team);
    if (!r) return;
    r.p++; r.gf += f; r.ga += a;
    if (f > a) r.w++; else if (f === a) r.d++; else r.l++;
  };
  for (const [h, a, hg, ag] of [...t.games, ...(withLive ? t.live : [])]) {
    if (mode !== "away") add(h, hg, ag);
    if (mode !== "home") add(a, ag, hg);
  }
  const table = [...rows.values()].map((r) => ({ ...r, pts: r.w * 3 + r.d, diff: r.gf - r.ga }))
    .sort((x, y) => y.pts - x.pts || y.diff - x.diff || y.gf - x.gf || x.team.localeCompare(y.team));
  const num: CSSProperties = { width: 22, textAlign: "center", flexShrink: 0 };
  const seg = (id: typeof mode, label: string) => (
    <button onClick={() => setMode(id)} aria-pressed={mode === id} style={{ height: 24, padding: "0 10px", border: "none", borderRadius: 6, background: mode === id ? "var(--tc-raise)" : "transparent", color: mode === id ? "var(--tc-text)" : "var(--tc-label)", fontSize: 11, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</button>
  );
  return (
    <>
      <Head title="Standings"><span style={{ ...caps, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.league} · last {t.days} days</span></Head>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, border: "1px solid var(--tc-line)" }}>{seg("overall", "Overall")}{seg("home", "Home")}{seg("away", "Away")}</span>
        {t.live.length > 0 && (
          <button onClick={() => setWithLive((v) => !v)} aria-pressed={withLive} title="Count the live scores as if the games ended now" style={{ height: 24, padding: "0 4px 0 10px", borderRadius: 12, border: `1px solid ${withLive ? "#E5484D" : "var(--tc-outline)"}`, background: "transparent", color: withLive ? "#E5484D" : "var(--tc-label)", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800 }}>
            LIVE<span style={{ width: 16, height: 16, borderRadius: 8, background: withLive ? "#E5484D" : "var(--tc-outline-strong)" }} />
          </button>
        )}
      </div>
      <div role="table" aria-label={`${t.league} table`} style={{ fontSize: 12.5 }}>
        <div role="row" style={{ display: "flex", alignItems: "center", gap: 4, height: 24, ...caps, fontSize: 10 }}>
          <span style={num}>#</span><span style={{ flex: 1 }}>Team</span>
          {["P", "W", "D", "L"].map((h) => <span key={h} style={num}>{h}</span>)}<span style={{ ...num, width: 32 }}>+/-</span><span style={{ ...num, width: 28 }}>Pts</span>
        </div>
        {table.map((r, k) => {
          const mine = r.team === m.home ? HOME : r.team === m.away ? AWAY : null;
          return (
            <div role="row" key={r.team} style={{ display: "flex", alignItems: "center", gap: 4, height: 27, borderTop: "1px solid var(--tc-line)", background: mine ? "var(--tc-raise)" : "transparent", boxShadow: mine ? `inset 3px 0 0 ${mine}` : "none", fontWeight: mine ? 800 : 600 }}>
              <span style={num}>{k + 1}</span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.team}</span>
              <span style={num}>{r.p}</span><span style={num}>{r.w}</span><span style={num}>{r.d}</span><span style={num}>{r.l}</span>
              <span style={{ ...num, width: 32 }}>{r.diff > 0 ? `+${r.diff}` : r.diff}</span><span style={{ ...num, width: 28, fontWeight: 800 }}>{r.w * 3 + r.d}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- timeline: what happened, by half, newest first (written from the match events) ----------
const BALL = <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#13171C" strokeWidth="1.5" /><path d="m12 7 4 3-1.5 4.5h-5L8 10z" fill="#13171C" /></svg>;
const CARD = (c: string) => <span aria-hidden="true" style={{ width: 10, height: 14, borderRadius: 2, background: c, display: "inline-block" }} />;
const FLAG = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 21V3" /><path d="M5 4h11l-2 4 2 4H5" fill="#E5484D" stroke="#E5484D" /></svg>;
const WHISTLE = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="14" r="5" /><path d="M13 11h8V8h-9" /></svg>;
function MatchTimeline({ m }: { m: TCMatch }) {
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const minute = m.momentum.length;
  const name = (side: "home" | "away") => (side === "home" ? m.home : m.away);
  type Line = { minute: number; side?: "home" | "away"; icon: ReactNode; text: string; strong?: boolean };
  const halves: { label: string; score: string; lines: Line[] }[] = [{ label: "1st Half", score: "", lines: [{ minute: 0, icon: WHISTLE, text: `Kick-off! ${m.home} v ${m.away} is under way.` }] }];
  let hs = 0, as = 0;
  const closeFirst = () => {
    if (halves.length > 1) return;
    halves[0].score = `${hs} - ${as}`;
    halves[0].lines.push({ minute: 45, icon: WHISTLE, text: `Half time: ${m.home} ${hs}–${as} ${m.away}.`, strong: true });
    if (m.clock !== "HT") halves.push({ label: "2nd Half", score: "", lines: [{ minute: 46, icon: WHISTLE, text: "The second half is under way." }] });
  };
  for (const e of [...(m.events ?? [])].sort((a, b) => a.minute - b.minute)) {
    if (e.minute > 45) closeFirst();
    const cur = halves[halves.length - 1].lines;
    if (e.type === "goal") {
      if (e.side === "home") hs++; else as++;
      cur.push({ minute: e.minute, side: e.side, icon: BALL, text: `GOAL! ${name(e.side)} score. ${m.home} ${hs}–${as} ${m.away}.`, strong: true });
    } else if (e.type === "red") cur.push({ minute: e.minute, side: e.side, icon: CARD("#E5484D"), text: `Red card! ${name(e.side)} are down to ten men.`, strong: true });
    else if (e.type === "yellow") cur.push({ minute: e.minute, side: e.side, icon: CARD("#F5C518"), text: `Yellow card for ${name(e.side)}.` });
    else cur.push({ minute: e.minute, side: e.side, icon: FLAG, text: `Corner to ${name(e.side)}.` });
  }
  if (minute >= 45 || m.clock === "HT") closeFirst();
  halves[halves.length - 1].score ||= `${hs} - ${as}`;
  const toggle = (k: number) => setClosed((c) => { const n = new Set(c); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <>
      <Head title="Timeline" />
      {halves.map((h, k) => ({ h, k })).reverse().map(({ h, k }) => (
        <section key={h.label}>
          <button onClick={() => toggle(k)} aria-expanded={!closed.has(k)} style={{ width: "100%", height: 30, padding: "0 2px", border: "none", borderBottom: "1px solid var(--tc-line)", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{h.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" style={{ transform: closed.has(k) ? "rotate(180deg)" : "none" }}><path d="m6 15 6-6 6 6" /></svg>
            </span>
            <span>{h.score}</span>
          </button>
          {!closed.has(k) && [...h.lines].reverse().map((l, j) => (
            <div key={j} style={{ padding: "7px 2px", borderBottom: "1px solid var(--tc-line)", display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 800, color: "var(--tc-soft)" }}>
                <span style={{ width: 28 }}>{l.minute}'</span>
                {l.side && <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={l.side === "home" ? HOME : AWAY} aria-hidden="true">{JERSEY}</svg>{teamCode(name(l.side))}
                </span>}
                <span style={{ display: "flex", color: "var(--tc-soft)" }}>{l.icon}</span>
              </span>
              <span style={{ fontSize: 13.5, lineHeight: 1.35, fontWeight: l.strong ? 800 : 500, color: l.strong ? "var(--tc-text)" : "var(--tc-soft)" }}>{l.text}</span>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

// ---------- line-ups: formations and shirt numbers on a pitch (no player names until a real provider) ----------
function Lineups({ m, info }: { m: TCMatch; info: Info }) {
  if (!info?.available || !info.lineups) return <><Head title="Line-ups" /><Note>{info ? "Line-ups aren't available for this match yet." : "Loading…"}</Note></>;
  const { home, away } = info.lineups;
  const W = 360, H = 172, R = 11;
  const spots = (l: Lineup, side: "home" | "away") => {
    const lines = l.formation.split("-").map(Number);
    return l.players.map((p) => {
      const count = p.line === 0 ? 1 : lines[p.line - 1];
      const j = l.players.filter((q) => q.line === p.line).indexOf(p);
      const x = p.line === 0 ? 18 : 18 + (p.line * (W / 2 - 34)) / lines.length;
      const y = 8 + ((j + 0.5) * (H - 16)) / count;
      return { p, x: side === "home" ? x : W - x, y: side === "home" ? y : H - y };
    });
  };
  const player = ({ p, x, y }: { p: Lineup["players"][number]; x: number; y: number }, side: "home" | "away") => (
    <g key={`${side}-${p.n}`}>
      <circle cx={x} cy={y} r={R} fill={side === "home" ? HOME : AWAY} opacity={p.red ? 0.45 : 1} />
      <text x={x} y={y + 3.6} textAnchor="middle" fontSize={10.5} fontWeight={800} fill={side === "home" ? "#13171C" : "#fff"}>{p.n}</text>
      {(p.yellow > 0 || p.red) && <rect x={x + 6} y={y - R - 1} width={6} height={8} rx={1} fill={p.red ? "#E5484D" : "#F5C518"} />}
      {p.goals > 0 && <g transform={`translate(${x + 8} ${y + 7})`}><circle r={4.2} fill="#fff" stroke="#13171C" strokeWidth={0.8} />{p.goals > 1 && <text x={6} y={3} fontSize={8} fontWeight={800} fill="#fff">{p.goals}</text>}</g>}
    </g>
  );
  return (
    <>
      <Head title="Line-ups">
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800 }}>
          <span style={{ color: HOME }}>{home.formation}</span><span style={{ ...caps, fontSize: 9.5 }}>Formation</span><span style={{ color: AWAY }}>{away.formation}</span>
        </span>
      </Head>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${m.home} ${home.formation}, ${m.away} ${away.formation}`} style={{ display: "block", borderRadius: 8 }}>
        {Array.from({ length: 10 }, (_, i) => <rect key={i} x={(W / 10) * i} y={0} width={W / 10} height={H} fill={i % 2 ? "#2B6E2E" : "#2F7732"} />)}
        <g fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2}>
          <rect x={3} y={3} width={W - 6} height={H - 6} /><line x1={W / 2} x2={W / 2} y1={3} y2={H - 3} /><circle cx={W / 2} cy={H / 2} r={22} />
          <rect x={3} y={H / 2 - 38} width={36} height={76} /><rect x={W - 39} y={H / 2 - 38} width={36} height={76} />
        </g>
        {spots(home, "home").map((s) => player(s, "home"))}
        {spots(away, "away").map((s) => player(s, "away"))}
      </svg>
    </>
  );
}

// ---------- live chat: its own card under the match view (like Bet9ja) ----------
export function LiveChat({ m, flat }: { m: TCMatch; flat?: boolean }) {
  const [open, setOpen] = useState(false);
  // Hide the phone's bottom nav while chatting, so it doesn't cover the message box.
  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("tc-chat-open");
    return () => document.documentElement.classList.remove("tc-chat-open");
  }, [open]);
  return (
    <section aria-label="Live chat" style={{ ...shell(flat), padding: 12 }}>
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
  const W = PITCH_W, H = PITCH_H;
  return (
    <div style={{ position: "relative" }}>
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
        {/* Poccabet mark painted on the grass, like a sponsor's logo */}
        <text x={W * 0.28} y={H - 20} textAnchor="middle" fontFamily="'Barlow Condensed', sans-serif" fontStyle="italic" fontWeight={700} fontSize={24} letterSpacing={-0.3} opacity={0.42}>
          <tspan fill="#fff">Pocca</tspan><tspan fill={ACCENT}>bet</tspan>
        </text>
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
