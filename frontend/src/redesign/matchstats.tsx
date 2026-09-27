// Stats pieces for the match page and the live match view: chances implied by the odds, what
// players are picking, live stats (possession, shots, corners) and the goals & cards timeline.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../api/client";
import type { TCMatch } from "./data";
import { impliedPct } from "./markets";
import { ACCENT } from "./shared";

const card: CSSProperties = { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14 };
const sectionTitle: CSSProperties = { margin: "0 0 12px", fontSize: 15, fontWeight: 800 };
const COLORS = [ACCENT, "var(--tc-outline-strong)", "#4C9EEB"];

// A titled block: a card of its own (boxed) or a plain section inside another card.
function Block({ title, sub, boxed, children }: { title: string; sub?: string; boxed?: boolean; children: ReactNode }) {
  return (
    <section style={boxed ? { ...card, padding: 16 } : { padding: "4px 0 8px" }}>
      <h2 style={{ ...sectionTitle, marginBottom: sub ? 2 : 12 }}>{title}</h2>
      {sub && <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--tc-label)" }}>{sub}</p>}
      {children}
    </section>
  );
}

function Bars3({ values, labels, colors }: { values: number[]; labels: string[]; colors: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 3, height: 10, borderRadius: 5, overflow: "hidden", background: "var(--tc-track)" }}>
        {values.map((v, i) => v > 0 && <span key={i} style={{ flex: v, background: colors[i] }} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        {labels.map((l, i) => (
          <span key={l} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1, textAlign: i === 0 ? "left" : i === labels.length - 1 ? "right" : "center" }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{values[i]}%</span>
            <span style={{ fontSize: 12, color: "var(--tc-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatRow({ label, home, away, unit = "" }: { label: string; home: number; away: number; unit?: string }) {
  const total = home + away || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
        <span>{home}{unit}</span><span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>{label}</span><span>{away}{unit}</span>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--tc-track)", display: "flex", justifyContent: "flex-end", overflow: "hidden" }}>
          <span style={{ width: `${(home / total) * 100}%`, background: home >= away ? ACCENT : "var(--tc-outline-strong)" }} />
        </div>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--tc-track)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${(away / total) * 100}%`, background: away > home ? ACCENT : "var(--tc-outline-strong)" }} />
        </div>
      </div>
    </div>
  );
}

export function Timeline({ m, boxed }: { m: TCMatch; boxed?: boolean }) {
  const events = (m.events ?? []).filter((e) => e.type !== "corner").reverse(); // goals and cards, newest first
  return (
    <Block title="Timeline" boxed={boxed}>
      {events.length ? (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {events.map((e, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: i ? "1px solid var(--tc-line)" : "none", flexDirection: e.side === "away" ? "row-reverse" : "row", textAlign: e.side === "away" ? "right" : "left" }}>
              <span style={{ width: 36, flexShrink: 0, fontSize: 13, fontWeight: 800, color: "var(--tc-soft)", textAlign: "center" }}>{e.minute}'</span>
              {e.type === "goal"
                ? <span aria-hidden="true" style={{ fontSize: 16 }}>⚽</span>
                : <span aria-hidden="true" style={{ width: 10, height: 14, borderRadius: 2, background: e.type === "red" ? "#E5484D" : "#F5C518", flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>{e.type === "goal" ? "Goal" : e.type === "red" ? "Red card" : "Yellow card"} · {e.side === "home" ? m.home : m.away}</span>
            </li>
          ))}
        </ol>
      ) : <p style={{ margin: 0, fontSize: 14, color: "var(--tc-label)" }}>No goals or cards yet.</p>}
    </Block>
  );
}

export function LiveStats({ m, boxed }: { m: TCMatch; boxed?: boolean }) {
  if (!m.stats) return null;
  return (
    <Block title="Match stats" boxed={boxed}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StatRow label="Possession" home={m.stats.possession[0]} away={m.stats.possession[1]} unit="%" />
        <StatRow label="Shots" home={m.stats.shots[0]} away={m.stats.shots[1]} />
        <StatRow label="Corners" home={m.stats.corners[0]} away={m.stats.corners[1]} />
      </div>
    </Block>
  );
}

export function ChanceAndPicks({ m, boxed }: { m: TCMatch; boxed?: boolean }) {
  const [picks, setPicks] = useState<{ total: number; shares: number[] } | null>(null);
  useEffect(() => {
    let live = true;
    api.getMatchPicks(m.id).then((r) => {
      const c = ["1", "X", "2"].map((sel) => r.picks.find((p) => p.market === "1x2" && p.selection === sel)?.count ?? 0);
      const t = c[0] + c[1] + c[2];
      if (!live || !t) return;
      const pct = c.map((x) => Math.round((x / t) * 100));
      pct[2] = 100 - pct[0] - pct[1];
      setPicks({ total: r.total, shares: pct });
    }).catch(() => {});
    return () => { live = false; };
  }, [m.id]);
  const labels = [m.home, "Draw", m.away];
  return (
    <>
      {m.o[0] > 0 && <Block boxed={boxed} title="Chance implied by odds" sub={m.live ? "From the current in-play 1X2 prices" : "From the 1X2 prices"}>
        <Bars3 values={impliedPct(m.o)} labels={labels} colors={COLORS} />
      </Block>}
      {picks && <Block boxed={boxed} title="What players are picking" sub={`${picks.total.toLocaleString("en-US")} pick${picks.total === 1 ? "" : "s"} on this match today`}>
        <Bars3 values={picks.shares} labels={labels} colors={COLORS} />
      </Block>}
    </>
  );
}
