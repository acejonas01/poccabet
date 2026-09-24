import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { type TCMatch, TOP_LEAGUES, dateOptions, dayLabel, groupByLeague, hhmm, leagueRank, matchesDate } from "./data";
import {
  AviatorIcon, CasinoIcon, ChevronLeft, ChevronRight, JackpotIcon, MoonIcon, SearchIcon, SportsIcon, StarIcon, VirtualsIcon,
} from "./icons";
import { DESKTOP_PILLS, deriveOdds, desktopCols, marketCount, marketDef } from "./markets";
import { Crest, Flag } from "./media";
import { ChanceBar, FeaturedCard, type HomeTab, StatBar, featuredLive } from "./mobile";
import { featuredUpcoming, usePickOfTheDay } from "./potd";
import { ACCENT, useThemeButton, BetSlipBody, CheckBet, DemoTag, OddButton, SHOW_TAB_FEATURE, WELCOME_BONUS_AMOUNT, usePicker } from "./shared";

const barlow = "'Barlow Condensed', sans-serif";
const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const card: CSSProperties = { background: "var(--tc-panel)", border: "1px solid var(--tc-line)", borderRadius: 14 };

// ---------- header ----------
const NAV = [
  { label: "Sports", Icon: SportsIcon },
  { label: "Aviator", Icon: AviatorIcon },
  { label: "Virtuals", Icon: VirtualsIcon },
  { label: "Jackpot", Icon: JackpotIcon },
  { label: "Casino", Icon: CasinoIcon },
];

export function DesktopHeader({ search, setSearch, simulated }: { search: string; setSearch: (v: string) => void; simulated: boolean }) {
  const { isAuthenticated, balance, logout } = useAuth();
  const themeBtn = useThemeButton();
  const navigate = useNavigate();
  return (
    <header className="tc-dheader" style={{ height: 72, display: "flex", alignItems: "center", gap: 32, padding: "0 24px", background: "var(--tc-panel)", borderBottom: "1px solid var(--tc-line)", position: "sticky", top: 0, zIndex: 30 }}>
      <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, textDecoration: "none", color: "var(--tc-text)" }}>
        <span style={{ fontFamily: barlow, fontStyle: "italic", fontWeight: 700, fontSize: 34, letterSpacing: -0.5, lineHeight: 1 }}>Pocca<span style={{ color: ACCENT }}>bet</span></span>
        {simulated && <DemoTag />}
      </a>
      <nav aria-label="Sections" style={{ display: "flex", alignItems: "center", flexGrow: 1 }}>
        {NAV.map(({ label, Icon }, i) => {
          const on = i === 0;
          return (
            <a key={label} href="/" onClick={(e) => { e.preventDefault(); if (on) navigate("/"); }} style={{
              height: 72, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", textDecoration: "none", fontSize: 14,
              fontWeight: on ? 800 : 600, color: on ? ACCENT : "var(--tc-soft)", borderBottom: `2px solid ${on ? ACCENT : "transparent"}`, boxSizing: "border-box",
            }} aria-label={label}><Icon size={20} /><span className="tc-dnav-label">{label}</span></a>
          );
        })}
      </nav>
      <label className="tc-dsearch" style={{ width: 240, height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", borderRadius: 10, background: "var(--tc-raise)", color: "var(--tc-label)", boxSizing: "border-box" }}>
        <SearchIcon />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teams or leagues" style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 14 }} />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button aria-label="Switch theme" {...themeBtn} style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid var(--tc-outline)", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><MoonIcon /></button>
        {isAuthenticated ? (
          <>
            <span style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid var(--tc-outline-strong)", color: "var(--tc-text)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center" }}>₦{balance.toFixed(2)}</span>
            <button onClick={logout} style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontWeight: 800, fontSize: 14 }}>Log out</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate("/signup")} style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid var(--tc-outline-strong)", background: "transparent", color: "var(--tc-text)", fontWeight: 700, fontSize: 14 }}>Join</button>
            <button onClick={() => navigate("/login")} style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontWeight: 800, fontSize: 14 }}>Login</button>
          </>
        )}
      </div>
    </header>
  );
}

// ---------- sidebar ----------
const SPORTS = ["Football", "Basketball", "Tennis", "Table tennis", "Ice hockey", "Volleyball"];
export function Sidebar({ footballCount, league, setLeague }: { footballCount: number; league: string | null; setLeague: (l: string | null) => void }) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 2, padding: 12 }}>
        <span style={{ padding: "4px 12px 8px", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--tc-label)" }}>SPORTS</span>
        {SPORTS.map((s, i) => (
          <a key={s} href="/" className="tc-side-link" onClick={(e) => e.preventDefault()} style={i === 0 ? { background: "var(--tc-raise)", color: "var(--tc-text)" } : undefined}>
            <span>{s}</span>
            {i === 0 && <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{footballCount}</span>}
          </a>
        ))}
      </div>
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 2, padding: 12 }}>
        <span style={{ padding: "4px 12px 8px", fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--tc-label)" }}>TOP LEAGUES</span>
        {TOP_LEAGUES.map((l) => (
          <a key={l} href="/" className="tc-side-link" aria-current={league === l ? "true" : undefined}
            onClick={(e) => { e.preventDefault(); setLeague(league === l ? null : l); }}
            style={league === l ? { background: "var(--tc-raise)", color: "var(--tc-text)" } : undefined}>
            <span>{l}</span><ChevronRight size={14} color="#5E6A74" />
          </a>
        ))}
      </div>
    </aside>
  );
}

// ---------- tabs + chips ----------
function Tabs({ current, liveCount, onLive, onUpcoming, onTop, right }: {
  current: "live" | "upcoming" | "top"; liveCount: number; onLive: () => void; onUpcoming: () => void; onTop: () => void; right: ReactNode;
}) {
  const tab = (on: boolean, color = ACCENT): CSSProperties => ({
    height: 48, padding: 0, background: "transparent", border: "none", borderBottom: `2px solid ${on ? color : "transparent"}`,
    color: on ? "var(--tc-text)" : "var(--tc-muted)", fontWeight: on ? 800 : 700, fontSize: 16, whiteSpace: "nowrap",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 16, borderBottom: "1px solid var(--tc-line)" }}>
      <div role="tablist" style={{ display: "flex", gap: 28 }}>
        <button role="tab" aria-selected={current === "live"} onClick={onLive} style={{ ...tab(current === "live", "#E5484D"), display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#E5484D", boxShadow: "0 0 0 3px rgba(229,72,77,0.25)" }} />
          Live <span style={{ padding: "1px 7px", borderRadius: 9, background: "#E5484D", color: "#FFFFFF", fontSize: 12, fontWeight: 800 }}>{liveCount}</span>
        </button>
        <button role="tab" aria-selected={current === "upcoming"} onClick={onUpcoming} style={tab(current === "upcoming")}>Upcoming</button>
        <button role="tab" aria-selected={current === "top"} onClick={onTop} style={tab(current === "top")}>Top leagues</button>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "7px 0" }}>{right}</div>
    </div>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      height: 34, padding: "0 14px", borderRadius: 17, border: on ? "none" : "1px solid var(--tc-outline)",
      background: on ? "var(--tc-text)" : "transparent", color: on ? "#13171C" : "var(--tc-text)", fontSize: 13, fontWeight: on ? 800 : 600, whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

// ---------- markets card (league table) ----------
function Pills({ pill, setPill }: { pill: string; setPill: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Markets" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--tc-line)" }}>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "var(--tc-label)", marginRight: 4 }}>MARKETS</span>
      {DESKTOP_PILLS.map((p) => {
        const on = p.id === pill;
        return (
          <button key={p.id} role="tab" aria-selected={on} onClick={() => setPill(p.id)} style={{
            height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${on ? ACCENT : "var(--tc-outline)"}`, background: "transparent",
            color: on ? ACCENT : "var(--tc-soft-2)", fontSize: 13, fontWeight: on ? 800 : 600, whiteSpace: "nowrap",
          }}>{p.label}</button>
        );
      })}
    </div>
  );
}

function OddsGroups({ m, pill, live, flashBase }: { m: TCMatch; pill: string; live: boolean; flashBase: number }) {
  const { isOn, pick } = usePicker();
  const all = deriveOdds(m.o, m.ou);
  const markets = DESKTOP_PILLS.find((p) => p.id === pill)!.markets;
  const dirMap: Record<string, string[]> = { "1x2": m.dirs["1x2"], ou: m.dirs.ou, hc: m.dirs["1x2"] };
  let n = flashBase;
  return (
    <div style={{ display: "flex", gap: 20 }}>
      {markets.map((mid) => {
        const def = marketDef(mid);
        const label = mid === "ou" ? "Total 2.5" : def.label;
        return (
          <div key={mid} style={{ display: "flex", gap: 6 }}>
            {def.cols.map((c, i) => {
              const v = all[mid]?.[i] ?? 0;
              const id = `${m.id}|${mid}|${c}`;
              return (
                <OddButton key={c} variant="desk" value={v} on={isOn(id)} flash={n++}
                  dir={live ? ((dirMap[mid]?.[i] ?? "") as "up" | "down" | "") : ""}
                  aria={`${m.home} vs ${m.away} ${label} ${c}`} onPick={() => pick(m, mid, label, c, v)}
                  style={{ flexShrink: 0, width: 60, height: 44, fontSize: 19 }} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ColHeads({ pill }: { pill: string }) {
  const markets = DESKTOP_PILLS.find((p) => p.id === pill)!.markets;
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <span style={{ width: 44 }} />
      <div style={{ display: "flex", gap: 20, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
        {markets.map((mid) => (
          <div key={mid} style={{ display: "flex", gap: 6 }}>
            {desktopCols(mid).map((c) => <span key={c} style={{ width: 60, textAlign: "center" }}>{c}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function LeagueTable({ matches, pill, setPill, live, limit, onMore }: {
  matches: TCMatch[]; pill: string; setPill: (id: string) => void; live: boolean; limit?: number; onMore?: () => void;
}) {
  const leagues = groupByLeague(limit ? matches.slice(0, limit) : matches);
  let row = 0;
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Pills pill={pill} setPill={setPill} />
      {leagues.map((lg) => (
        <section key={lg.key} style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "12px 20px 8px", background: "var(--tc-panel-2)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--tc-label)" }}>{lg.country}</span>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{lg.name}</span>
            </div>
            <ColHeads pill={pill} />
          </div>
          {lg.matches.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 16, height: 64, padding: "0 20px", borderTop: "1px solid var(--tc-line)" }}>
              {live ? (
                <div style={{ width: 40, flexShrink: 0, fontSize: 14, fontWeight: 800, color: m.clock === "HT" ? "var(--tc-muted)" : "#E5484D" }}>{m.clock}</div>
              ) : (
                <div style={{ width: 52, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tc-label)" }}>{dayLabel(m.start)}</span>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{hhmm(m.start)}</span>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {live ? (
                  [[m.home, m.hs, m.red === "home"], [m.away, m.as, m.red === "away"]].map(([name, score, red]) => (
                    <div key={String(name)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, lineHeight: "22px" }}>
                      <span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, ...ellipsis }}>{name}</span>
                        <span aria-label="Red card" style={{ display: red ? "inline-block" : "none", flexShrink: 0, width: 9, height: 12, borderRadius: 2, background: "#E5484D" }} />
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{score}</span>
                    </div>
                  ))
                ) : (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: "22px", ...ellipsis }}>{m.home}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: "22px", ...ellipsis }}>{m.away}</span>
                  </>
                )}
              </div>
              <a href="#" onClick={(e) => e.preventDefault()} aria-label={`All ${marketCount(m.o, m.ou)} markets for ${m.home} vs ${m.away}`} style={{ width: 44, flexShrink: 0, fontSize: 12, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>+{marketCount(m.o, m.ou)}</a>
              <OddsGroups m={m} pill={pill} live={live} flashBase={(row++) * 5} />
            </div>
          ))}
        </section>
      ))}
      {matches.length === 0 && (
        <p style={{ padding: "28px 20px", margin: 0, textAlign: "center", fontSize: 14, color: "var(--tc-label)" }}>{live ? "No live games right now." : "No matches for this filter."}</p>
      )}
      {onMore && limit !== undefined && matches.length > limit && (
        <button onClick={onMore} style={{ height: 52, border: "none", borderTop: "1px solid var(--tc-line)", background: "transparent", color: "var(--tc-text)", fontSize: 14, fontWeight: 700 }}>Load more matches</button>
      )}
    </div>
  );
}

// ---------- rail ----------
export function Rail() {
  return (
    <div style={{ width: 330, flexShrink: 0, position: "sticky", top: 96 }}>
      <aside aria-label="Bet slip" style={{ ...card, display: "flex", flexDirection: "column", overflow: "hidden", alignSelf: "flex-start" }}>
        <BetSlipBody />
      </aside>
      <CheckBet />
    </div>
  );
}

const matchSearch = (m: TCMatch, q: string) => !q || `${m.home} ${m.away} ${m.league} ${m.country}`.toLowerCase().includes(q.toLowerCase());

// ---------- home ----------
// Home keeps its top section fixed; the Live / Upcoming / Top leagues tabs only switch the table below.
// The Live tab leads with the featured live match (score, stats, 1X2).
export function DesktopHome({ upcoming, live, tab, setTab, search, league }: {
  upcoming: TCMatch[]; live: TCMatch[]; tab: HomeTab; setTab: (t: HomeTab) => void;
  search: string; league: string | null;
}) {
  const navigate = useNavigate();
  const { isOn, pick } = usePicker();
  const [dateId, setDateId] = useState("all");
  const [pill, setPill] = useState("main");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(15);

  const ranked = useMemo(() => [...upcoming].sort((a, b) => leagueRank(a.league) - leagueRank(b.league) || a.start - b.start), [upcoming]);
  const p = usePickOfTheDay(upcoming, ranked[0]);
  const potd = p?.m;
  const featured = ranked.filter((m) => m.id !== potd?.id).slice(0, 9);
  const pages = Math.max(1, Math.ceil(featured.length / 3));
  const shown = featured.slice(page * 3, page * 3 + 3);

  const isLive = tab === "live";
  const tabList = (isLive ? live : upcoming)
    .filter((m) => isLive || matchesDate(m, dateId))
    .filter((m) => isLive || tab === "upcoming" || TOP_LEAGUES.includes(m.league))
    .filter((m) => !league || m.league === league)
    .filter((m) => matchSearch(m, search))
    .sort((a, b) => a.start - b.start);
  // Every tab leads with a featured match (one switch turns them all off).
  const featuredMatch = !SHOW_TAB_FEATURE ? undefined : isLive ? featuredLive(tabList) : featuredUpcoming(tabList, potd?.id);
  const list = tabList.filter((m) => m !== featuredMatch);

  const potdId = potd && p ? `${potd.id}|${p.marketId}|${p.col}` : "";
  const navBtn = (disabled: boolean): CSSProperties => ({
    width: 32, height: 32, borderRadius: 16, border: "1px solid var(--tc-outline)", background: "transparent",
    color: disabled ? "var(--tc-faint)" : "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center",
  });

  return (
    <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16 }}>
        {potd && p && (
          <section aria-label="Pick of the day" style={{ flex: 2, padding: 20, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}><StarIcon />PICK OF THE DAY</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800 }}>{p.title}</span>
              <span style={{ fontSize: 13, color: "var(--tc-muted)" }}>{p.sub}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 14px", background: "var(--tc-page)", borderRadius: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{p.label}</span>
                <span style={{ fontSize: 13, color: "var(--tc-muted)" }}>{p.note}</span>
              </div>
              <OddButton variant="desk" value={p.odds} on={isOn(potdId)} aria={p.label} onPick={() => pick(potd, p.marketId, p.marketLabel, p.col, p.odds)} style={{ flexShrink: 0, width: 72, height: 48, fontSize: 19 }} />
            </div>
          </section>
        )}
        <a href="/signup" onClick={(e) => { e.preventDefault(); navigate("/signup"); }} style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12, background: "var(--tc-card)", border: "1px dashed var(--tc-outline-strong)", borderRadius: 14, textDecoration: "none", color: "var(--tc-text)" }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "var(--tc-label)" }}>NEW CUSTOMERS</span>
          <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.3 }}>Welcome bonus up to <span style={{ color: ACCENT }}>{WELCOME_BONUS_AMOUNT}</span> on your first deposit</span>
          <span style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: ACCENT, color: "#13171C", fontSize: 15, fontWeight: 800 }}>Join and claim</span>
        </a>
      </div>

      <section aria-label="Featured matches" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Featured matches</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setTab("upcoming"); }} style={{ marginRight: 8, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>View all</a>
            <button aria-label="Previous" disabled={page === 0} onClick={() => setPage((x) => x - 1)} style={navBtn(page === 0)}><ChevronLeft /></button>
            <button aria-label="Next" disabled={page >= pages - 1} onClick={() => setPage((x) => x + 1)} style={navBtn(page >= pages - 1)}><ChevronRight /></button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {shown.map((m) => <div key={m.id} style={{ flex: 1, minWidth: 0, display: "flex" }}><FeaturedCard m={m} width="100%" /></div>)}
        </div>
      </section>

      <Tabs current={tab} liveCount={live.length}
        onLive={() => { setTab("live"); setLimit(15); }} onUpcoming={() => { setTab("upcoming"); setLimit(15); }} onTop={() => { setTab("top"); setLimit(15); }}
        right={isLive ? <Chip on>Football · {live.length}</Chip> : dateOptions().map((d) => <Chip key={d.id} on={d.id === dateId} onClick={() => { setDateId(d.id); setLimit(15); }}>{d.label}</Chip>)} />

      {featuredMatch && <FeaturedMatchWide f={featuredMatch} onMoreMarkets={() => setPill("dc")} />}

      <LeagueTable matches={list} pill={pill} setPill={setPill} live={isLive} limit={limit} onMore={() => setLimit((l) => l + 15)} />
    </main>
  );
}

// ---------- live ----------
// Featured match at the top of each table tab (wide). Live: score, minute and stats.
// Upcoming: kickoff time and the chance implied by the odds.
function FeaturedMatchWide({ f, onMoreMarkets }: { f: TCMatch; onMoreMarkets: () => void }) {
  const { isOn, pick } = usePicker();
  return (
    <section aria-label={f.live ? "Featured live match" : "Featured match"} style={{ display: "flex", gap: 28, padding: "20px 24px", background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "var(--tc-label)" }}><Flag country={f.country} size={16} />{f.country ? `${f.country} · ` : ""}{f.league}</span>
          {f.live ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: f.clock === "HT" ? "var(--tc-muted)" : "#E5484D" }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: "#E5484D" }} />{f.clock}
            </span>
          ) : (
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--tc-soft)" }}>{dayLabel(f.start)}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[f.home, null, f.away].map((name, i) => name === null ? (
            <div key="mid" style={{ fontFamily: barlow, fontSize: 56, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>{f.live ? `${f.hs} – ${f.as}` : hhmm(f.start)}</div>
          ) : (
            <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
              <Crest name={name} url={i === 0 ? f.homeLogo : f.awayLogo} size={52} fontSize={14} />
              <span style={{ fontSize: 16, fontWeight: 800, ...ellipsis, maxWidth: "100%" }}>{name}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 1, background: "var(--tc-line)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
        {f.live ? f.stats && <>
          <StatBar big label="Possession" h={f.stats.possession[0]} a={f.stats.possession[1]} />
          <StatBar big label="Shots" h={f.stats.shots[0]} a={f.stats.shots[1]} />
          <StatBar big label="Corners" h={f.stats.corners[0]} a={f.stats.corners[1]} />
        </> : <ChanceBar m={f} big />}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <div aria-hidden="true" style={{ display: "flex", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
            {["1", "X", "2"].map((c) => <span key={c} style={{ flex: 1, textAlign: "center" }}>{c}</span>)}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["1", "X", "2"].map((c, i) => (
              <div key={c} style={{ flex: 1, display: "flex" }}>
                <OddButton variant="desk" value={f.o[i]} on={isOn(`${f.id}|1x2|${c}`)} dir={f.dirs["1x2"][i]} flash={i}
                  aria={`${f.home} vs ${f.away} 1X2 ${c}`} onPick={() => pick(f, "1x2", "1X2", c, f.o[i])}
                  style={{ flexShrink: 0, width: "100%", height: 48, fontSize: 19 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid var(--tc-outline-2)", background: "transparent", color: "var(--tc-text)", fontSize: 13, fontWeight: 700 }}>{f.live ? "Match tracker" : "Match preview"}</button>
          <button onClick={onMoreMarkets} style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid var(--tc-outline-2)", background: "transparent", color: ACCENT, fontSize: 13, fontWeight: 700 }}>+{marketCount(f.o, f.ou)} {f.live ? "live markets" : "markets"}</button>
        </div>
      </div>
    </section>
  );
}
