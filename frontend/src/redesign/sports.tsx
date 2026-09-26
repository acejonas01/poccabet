// Sports page (/sports/<sport>): sport tabs, shortcut cards, dates and leagues — plus the
// match lists they open (/sports/football/today | live | all | soon | 2026-09-25).
import { useEffect, useMemo, useState, type ComponentType, type ReactElement } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { zoned } from "../lib/browser";
import { type TCMatch, dayHeading, leagueRank, leagueSlug } from "./data";
import {
  AmFootballIcon, BaseballIcon, BasketballIcon, BoxingIcon, CheckIcon, ChevronRight, CricketIcon, DartsIcon,
  IceHockeyIcon, SportsIcon, TableTennisIcon, TennisIcon, VirtualsIcon, VolleyballIcon,
} from "./icons";
import { Flag } from "./media";
import { type ListViewProps, MatchListPage, PageHeader, QUICK_LINKS } from "./mobile";
import { ON_ACCENT, ACCENT_TEXT, ACCENT } from "./shared";

type Icon = (p: { size?: number }) => ReactElement;

// Only football has matches today; the other sports open a "coming soon" page.
export const SPORTS: { slug: string; name: string; Icon: Icon; ready?: boolean }[] = [
  { slug: "football", name: "Football", Icon: SportsIcon, ready: true },
  { slug: "basketball", name: "Basketball", Icon: BasketballIcon },
  { slug: "tennis", name: "Tennis", Icon: TennisIcon },
  { slug: "table-tennis", name: "Table Tennis", Icon: TableTennisIcon },
  { slug: "ice-hockey", name: "Ice Hockey", Icon: IceHockeyIcon },
  { slug: "volleyball", name: "Volleyball", Icon: VolleyballIcon },
  { slug: "baseball", name: "Baseball", Icon: BaseballIcon },
  { slug: "american-football", name: "American Football", Icon: AmFootballIcon },
  { slug: "boxing", name: "Boxing", Icon: BoxingIcon },
  { slug: "darts", name: "Darts", Icon: DartsIcon },
  { slug: "cricket", name: "Cricket", Icon: CricketIcon },
  { slug: "efootball", name: "eFootball", Icon: VirtualsIcon },
];

const HOUR = 3600000;
// Local calendar date as yyyy-mm-dd (used in date URLs).
const ymd = (t: number) => {
  const d = zoned(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isToday = (m: TCMatch) => ymd(m.start) === ymd(Date.now());
const inNext3h = (m: TCMatch) => m.start - Date.now() <= 3 * HOUR;

type Props = { upcoming: TCMatch[]; live: TCMatch[]; loaded: boolean };

// ---------- time filter (Daily chips, Range slider, custom dates) ----------
type When =
  | { kind: "any" }
  | { kind: "day"; id: string }
  | { kind: "hours"; h: number }
  | { kind: "dates"; from: string; to: string };
const HOUR_STOPS = [0, 1, 3, 6, 12, 24, 72, 168];
const STOP_LABELS = ["Any", "1h", "3h", "6h", "12h", "1d", "3d", "1w"];
const isYmd = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const fromYmd = (v: string) => { const [y, mo, d] = v.split("-").map(Number); return new Date(y, mo - 1, d).getTime(); };
const shortDate = (v: string) => new Date(fromYmd(v)).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function passes(w: When, m: TCMatch) {
  if (w.kind === "day") return ymd(m.start) === w.id;
  if (w.kind === "hours") return m.start - Date.now() <= w.h * HOUR;
  if (w.kind === "dates") { const d = ymd(m.start); return d >= w.from && d <= w.to; }
  return true;
}
function describe(w: When) {
  if (w.kind === "day") return dayHeading(fromYmd(w.id));
  if (w.kind === "hours") return w.h < 24 ? `Next ${w.h} hour${w.h === 1 ? "" : "s"}` : w.h === 168 ? "Next week" : `Next ${w.h / 24} day${w.h === 24 ? "" : "s"}`;
  if (w.kind === "dates") return w.from === w.to ? shortDate(w.from) : `${shortDate(w.from)} – ${shortDate(w.to)}`;
  return "All dates";
}
function toQuery(w: When, leagues: string[]) {
  const q = new URLSearchParams();
  if (w.kind === "day") q.set("day", w.id);
  if (w.kind === "hours") q.set("within", String(w.h));
  if (w.kind === "dates") { q.set("from", w.from); q.set("to", w.to); }
  if (leagues.length) q.set("leagues", leagues.join(","));
  return q.toString();
}
function fromQuery(q: URLSearchParams): { when: When; leagues: string[] } {
  const leagues = (q.get("leagues") ?? "").split(",").filter(Boolean);
  const day = q.get("day"); const from = q.get("from"); const to = q.get("to"); const within = Number(q.get("within"));
  const when: When = isYmd(day) ? { kind: "day", id: day }
    : within > 0 ? { kind: "hours", h: within }
    : isYmd(from) && isYmd(to) ? { kind: "dates", from, to }
    : { kind: "any" };
  return { when, leagues };
}

// Desktop renders the same page in the middle column: sticky under the 72px header,
// and the "Show matches" bar sticks to the bottom of the column (no bottom nav there).
export function SportPage({ upcoming, live, loaded, desktop = false }: Props & { desktop?: boolean }) {
  const { sport = "football" } = useParams();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [sport]);
  const current = SPORTS.find((s) => s.slug === sport);

  if (!current) return <Navigate to="/sports/football" replace />;

  const cards = [
    { view: "today", label: "Today's games", count: upcoming.filter(isToday).length + live.length },
    { view: "live", label: "Live", count: live.length, live: true },
    { view: "all", label: "All football", count: upcoming.length + live.length },
    { view: "soon", label: "Next 3 hours", count: upcoming.filter(inNext3h).length },
  ];
  const card = { minHeight: 56, padding: "0 14px", borderRadius: 12, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--tc-text)" } as const;
  const go = (path: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(path); };

  return (
    <div className={desktop ? undefined : "tc-mobile-page"} style={desktop ? { flex: 1, minWidth: 0 } : undefined}>
      <div style={{ position: "sticky", top: desktop ? 72 : "var(--tc-header-h, 69px)", zIndex: 20, background: "var(--tc-page)" }}>
        <PageHeader title="Sports" />
        {/* Sport tabs */}
        <nav aria-label="Sports" className="tc-hscroll" style={{ display: "flex", gap: 4, padding: "0 8px", overflowX: "auto", borderBottom: "1px solid var(--tc-divider)" }}>
          {SPORTS.map(({ slug, name, Icon }) => {
            const on = slug === sport;
            return (
              <a key={slug} href={`/sports/${slug}`} aria-current={on ? "page" : undefined} onClick={(e) => { e.preventDefault(); navigate(`/sports/${slug}`, { replace: true }); }} style={{
                flex: "0 0 auto", minWidth: 72, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                borderBottom: `2px solid ${on ? ACCENT : "transparent"}`, textDecoration: "none",
                color: on ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 12, fontWeight: on ? 800 : 600, whiteSpace: "nowrap",
              }}>
                <span style={{ color: on ? ACCENT : "inherit", display: "flex" }}><Icon size={22} /></span>
                {name}
              </a>
            );
          })}
        </nav>
      </div>

      {!current.ready ? (
        <div style={{ padding: "56px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, textAlign: "center" }}>
          <span style={{ width: 64, height: 64, borderRadius: 32, background: "var(--tc-card)", color: ACCENT_TEXT, display: "flex", alignItems: "center", justifyContent: "center" }}><current.Icon size={32} /></span>
          <h2 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800 }}>{current.name} is coming soon</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", maxWidth: 280 }}>We're adding {current.name.toLowerCase()} markets. Meanwhile, there's plenty of football to bet on.</p>
          <button onClick={() => navigate("/sports/football", { replace: true })} style={{ marginTop: 8, height: 44, padding: "0 20px", borderRadius: 10, border: "none", background: ACCENT, color: ON_ACCENT, fontSize: 14, fontWeight: 800 }}>Go to football</button>
        </div>
      ) : (
        <>
          {/* Shortcut cards */}
          <div style={{ padding: "16px 16px 0", display: "grid", gridTemplateColumns: `repeat(${desktop ? 4 : 2}, minmax(0, 1fr))`, gap: 8 }}>
            {cards.map((c) => (
              <a key={c.view} href={`/sports/football/${c.view}`} onClick={go(`/sports/football/${c.view}`)} style={card}>
                {c.live && <span style={{ width: 7, height: 7, flexShrink: 0, borderRadius: 4, background: "#E5484D" }} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700 }}>{c.label}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: c.live && c.count ? "#E5484D" : "var(--tc-label)" }}>{loaded ? c.count : "–"}</span>
              </a>
            ))}
          </div>

          <FootballFilter upcoming={upcoming} loaded={loaded} desktop={desktop} />
        </>
      )}
    </div>
  );
}

// Daily | Range time filter, then leagues (Top leagues / Top countries / A–Z) with checkboxes,
// and a "Show N matches" bar that opens the filtered list. Counts follow the time filter.
function FootballFilter({ upcoming, loaded, desktop }: { upcoming: TCMatch[]; loaded: boolean; desktop: boolean }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"daily" | "range">("daily");
  const [rangeKind, setRangeKind] = useState<"time" | "date">("time");
  const [day, setDay] = useState<string | null>(null);
  const [stop, setStop] = useState(0);
  const [from, setFrom] = useState(() => ymd(Date.now()));
  const [to, setTo] = useState(() => ymd(Date.now() + 3 * 24 * HOUR));
  const [listTab, setListTab] = useState<"top" | "countries" | "az">("top");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const when: When = mode === "daily"
    ? (day ? { kind: "day", id: day } : { kind: "any" })
    : rangeKind === "time"
      ? (stop ? { kind: "hours", h: HOUR_STOPS[stop] } : { kind: "any" })
      : { kind: "dates", from: from <= to ? from : to, to: from <= to ? to : from };
  const pool = upcoming.filter((m) => passes(when, m));

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const t = Date.now() + i * 24 * HOUR;
    const id = ymd(t);
    return { id, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : zoned(t).toLocaleDateString("en-GB", { weekday: "long" }), count: upcoming.filter((m) => ymd(m.start) === id).length };
  }), [upcoming]);

  // Leagues (and countries) that have matches in the chosen time window.
  const leagueMap = new Map<string, { slug: string; country: string; name: string; count: number }>();
  for (const m of pool) {
    const slug = leagueSlug(m.country, m.league);
    const row = leagueMap.get(slug) ?? { slug, country: m.country, name: m.league, count: 0 };
    row.count++;
    leagueMap.set(slug, row);
  }
  const leagues = [...leagueMap.values()].sort((a, b) => leagueRank(a.name) - leagueRank(b.name) || b.count - a.count);
  const countryMap = new Map<string, { country: string; count: number; rank: number; leagues: typeof leagues }>();
  for (const l of leagues) {
    const c = countryMap.get(l.country) ?? { country: l.country, count: 0, rank: Infinity, leagues: [] };
    c.count += l.count;
    c.rank = Math.min(c.rank, leagueRank(l.name));
    c.leagues.push(l);
    countryMap.set(l.country, c);
  }
  const countries = [...countryMap.values()].sort((a, b) => listTab === "az" ? a.country.localeCompare(b.country) : a.rank - b.rank || b.count - a.count);

  const chosen = [...picked].filter((s) => leagueMap.has(s));
  const resultCount = chosen.length ? pool.filter((m) => picked.has(leagueSlug(m.country, m.league))).length : pool.length;
  const dirty = when.kind !== "any" || chosen.length > 0;
  const toggle = (slug: string) => setPicked((p) => { const n = new Set(p); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });
  const toggleOpen = (c: string) => setOpen((o) => { const n = new Set(o); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  const reset = () => { setDay(null); setStop(0); setPicked(new Set()); setMode("daily"); };
  const show = () => navigate(`/sports/football/filter?${toQuery(when, chosen)}`);

  const tabBtn = (on: boolean, size = 15) => ({
    height: 44, padding: 0, border: "none", background: "transparent", borderBottom: `2px solid ${on ? ACCENT : "transparent"}`,
    color: on ? "var(--tc-text)" : "var(--tc-muted)", fontSize: size, fontWeight: on ? 800 : 700, whiteSpace: "nowrap" as const,
  });
  const box = (on: boolean) => (
    <span aria-hidden="true" style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 5, border: `1.5px solid ${on ? ACCENT : "var(--tc-outline-strong)"}`, background: on ? ACCENT : "transparent", color: ON_ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {on && <CheckIcon size={14} />}
    </span>
  );
  const leagueRow = (l: (typeof leagues)[number], nested: boolean) => (
    <button key={l.slug} role="checkbox" aria-checked={picked.has(l.slug)} onClick={() => toggle(l.slug)} style={{
      width: "100%", minHeight: 52, padding: nested ? "0 0 0 34px" : 0, display: "flex", alignItems: "center", gap: 12, border: "none",
      borderBottom: "1px solid var(--tc-line)", background: "transparent", color: "var(--tc-text)", textAlign: "left",
    }}>
      {!nested && <Flag country={l.country} size={20} />}
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{l.name}</span>
        {!nested && <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{l.country}</span>}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tc-label)" }}>{l.count}</span>
      {box(picked.has(l.slug))}
    </button>
  );

  return (
    <>
      {/* Time filter */}
      <section style={{ marginTop: 20, borderTop: "1px solid var(--tc-divider)" }}>
        <div role="tablist" aria-label="Time filter" style={{ display: "flex", gap: 28, padding: "0 16px", borderBottom: "1px solid var(--tc-divider)" }}>
          <button role="tab" aria-selected={mode === "daily"} onClick={() => setMode("daily")} style={tabBtn(mode === "daily")}>Daily</button>
          <button role="tab" aria-selected={mode === "range"} onClick={() => setMode("range")} style={tabBtn(mode === "range")}>Range</button>
        </div>

        {mode === "daily" ? (
          <div className="tc-hscroll" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 16px" }}>
            {days.map((d) => {
              const on = day === d.id;
              return (
                <button key={d.id} aria-pressed={on} disabled={loaded && !d.count} onClick={() => setDay(on ? null : d.id)} style={{
                  flex: "0 0 auto", minWidth: 96, height: 40, padding: "0 14px", borderRadius: 10,
                  border: `1px solid ${on ? ACCENT : "var(--tc-outline)"}`, background: on ? "rgba(245, 197, 24, 0.12)" : "transparent",
                  color: on ? ACCENT : "var(--tc-text)", opacity: loaded && !d.count ? 0.4 : 1, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap",
                }}>{d.label}</button>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {([["time", "Custom time"], ["date", "Custom date"]] as const).map(([id, label]) => (
                <button key={id} aria-pressed={rangeKind === id} onClick={() => setRangeKind(id)} style={{
                  height: 36, padding: "0 14px", borderRadius: 8, border: "none",
                  background: rangeKind === id ? "var(--tc-raise)" : "transparent", color: rangeKind === id ? ACCENT : "var(--tc-muted)", fontSize: 14, fontWeight: 700,
                }}>{label}</button>
              ))}
            </div>
            {rangeKind === "time" ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
                  {STOP_LABELS.map((l, i) => <span key={l} style={{ color: i === stop ? ACCENT : undefined }}>{l}</span>)}
                </div>
                <input suppressHydrationWarning type="range" aria-label="Kick-off within" min={0} max={HOUR_STOPS.length - 1} step={1} value={stop} onChange={(e) => setStop(Number(e.target.value))}
                  style={{ width: "100%", marginTop: 8, accentColor: ACCENT }} />
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--tc-muted)" }}>{stop ? `Kick-off in the ${describe(when).toLowerCase()}` : "Slide to limit by kick-off time"}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([["From", from, setFrom], ["To", to, setTo]] as const).map(([label, value, set]) => (
                  <label key={label} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
                    {label}
                    <input suppressHydrationWarning type="date" value={value} min={ymd(Date.now())} onChange={(e) => e.target.value && set(e.target.value)} style={{
                      height: 44, padding: "0 10px", borderRadius: 10, border: "1px solid var(--tc-outline)", background: "var(--tc-card)", color: "var(--tc-text)", fontSize: 16, fontFamily: "inherit",
                    }} />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Leagues */}
      <section style={{ borderTop: "1px solid var(--tc-divider)" }}>
        <div role="tablist" aria-label="Leagues" style={{ display: "flex", gap: 24, padding: "0 16px", borderBottom: "1px solid var(--tc-divider)" }}>
          <button role="tab" aria-selected={listTab === "top"} onClick={() => setListTab("top")} style={tabBtn(listTab === "top", 14)}>Top Leagues</button>
          <button role="tab" aria-selected={listTab === "countries"} onClick={() => setListTab("countries")} style={tabBtn(listTab === "countries", 14)}>Top Countries</button>
          <button role="tab" aria-selected={listTab === "az"} onClick={() => setListTab("az")} style={tabBtn(listTab === "az", 14)}>A–Z</button>
        </div>
        <div style={{ padding: "0 16px" }}>
          <button role="checkbox" aria-checked={!chosen.length} onClick={() => setPicked(new Set())} style={{
            width: "100%", minHeight: 52, padding: 0, display: "flex", alignItems: "center", gap: 12, border: "none",
            borderBottom: "1px solid var(--tc-line)", background: "transparent", color: "var(--tc-text)", textAlign: "left",
          }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>All</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tc-label)" }}>{pool.length}</span>
            {box(!chosen.length)}
          </button>
          {listTab === "top" ? leagues.map((l) => leagueRow(l, false)) : countries.map((c) => {
            const isOpen = open.has(c.country);
            return (
              <div key={c.country}>
                <button aria-expanded={isOpen} onClick={() => toggleOpen(c.country)} style={{
                  width: "100%", minHeight: 52, padding: 0, display: "flex", alignItems: "center", gap: 12, border: "none",
                  borderBottom: "1px solid var(--tc-line)", background: "transparent", color: "var(--tc-text)", textAlign: "left",
                }}>
                  <span aria-hidden="true" style={{ color: ACCENT_TEXT, display: "flex", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}><ChevronRight /></span>
                  <Flag country={c.country} size={20} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{c.country}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tc-label)" }}>{c.count}</span>
                </button>
                {isOpen && c.leagues.map((l) => leagueRow(l, true))}
              </div>
            );
          })}
          {loaded && pool.length === 0 && <p style={{ margin: "16px 0", fontSize: 14, color: "var(--tc-label)" }}>No matches in this time range.</p>}
        </div>
      </section>

      {/* Room for the action bar, then the bar itself (mobile: just above the bottom nav). */}
      {!desktop && <div style={{ height: 88 }} />}
      <div style={desktop ? {
        position: "sticky", bottom: 16, zIndex: 25, margin: "16px 16px 0", padding: 10, borderRadius: 12,
        background: "var(--tc-panel)", border: "1px solid var(--tc-line)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", display: "flex", gap: 10,
      } : {
        position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 25,
        padding: "10px 16px 18px", background: "var(--tc-panel)", borderTop: "1px solid var(--tc-line)", display: "flex", gap: 10,
      }}>
        {dirty && <button onClick={reset} style={{ height: 46, padding: "0 16px", borderRadius: 10, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", fontSize: 14, fontWeight: 700 }}>Reset</button>}
        <button onClick={show} disabled={!resultCount} style={{
          flex: 1, height: 46, borderRadius: 10, border: "none", background: resultCount ? ACCENT : "var(--tc-raise)",
          color: resultCount ? ON_ACCENT : "var(--tc-faint)", fontSize: 15, fontWeight: 800,
        }}>{loaded ? `Show ${resultCount} match${resultCount === 1 ? "" : "es"}` : "Loading…"}</button>
      </div>
    </>
  );
}

// Route pages below compute their matches, then hand them to a layout: the mobile
// MatchListPage by default, or the desktop DesktopListPage.
type RouteProps = Props & {
  market: string; setMarket: (id: string) => void; openSheet: () => void; onOpenMatch: (m: TCMatch) => void;
  View?: ComponentType<ListViewProps>;
};

// /league/<country-name>
export function LeaguePage({ upcoming, live, loaded, View = MatchListPage, ...rest }: RouteProps) {
  const { slug = "" } = useParams();
  const inLeague = (m: TCMatch) => leagueSlug(m.country, m.league) === slug;
  const liveList = live.filter(inLeague);
  const upList = upcoming.filter(inLeague);
  const sample = liveList[0] ?? upList[0];
  const known = QUICK_LINKS.find((q) => leagueSlug(q.country, q.name) === slug);
  const name = sample?.league ?? known?.name ?? "League";
  const country = sample?.country ?? known?.country ?? "";
  return <View title={name} sub={country} country={country} liveList={liveList} upList={upList} loaded={loaded} group="day" resetKey={slug} {...rest} />;
}

// /sports/football/<view>: the match list a card, date or filter opens.
export function SportListPage({ upcoming, live, loaded, View = MatchListPage, ...rest }: RouteProps) {
  const { sport = "", view = "" } = useParams();
  const [query] = useSearchParams();
  if (sport !== "football") return <Navigate to={`/sports/${sport}`} replace />;

  let title = "";
  let liveList: TCMatch[] = [];
  let upList: TCMatch[] = [];
  if (view === "today") { title = "Today's games"; liveList = live; upList = upcoming.filter(isToday); }
  else if (view === "live") { title = "Live football"; liveList = live; }
  else if (view === "all") { title = "All football"; liveList = live; upList = upcoming; }
  else if (view === "soon") { title = "Next 3 hours"; upList = upcoming.filter(inNext3h); }
  else if (view === "filter") {
    const { when, leagues } = fromQuery(query);
    upList = upcoming.filter((m) => passes(when, m) && (!leagues.length || leagues.includes(leagueSlug(m.country, m.league))));
    title = describe(when);
    return <View title={title} sub={leagues.length ? `Football · ${leagues.length} league${leagues.length === 1 ? "" : "s"}` : "Football"} liveList={[]} upList={upList} loaded={loaded}
      group="league" resetKey={query.toString()} {...rest} />;
  }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(view)) {
    const [y, mo, d] = view.split("-").map(Number);
    title = dayHeading(new Date(y, mo - 1, d).getTime());
    upList = upcoming.filter((m) => ymd(m.start) === view);
  } else return <Navigate to="/sports/football" replace />;

  return <View title={title} sub="Football" liveList={liveList} upList={upList} loaded={loaded} group="league" resetKey={view} {...rest} />;
}
