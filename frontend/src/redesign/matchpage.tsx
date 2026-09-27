// Match page (/match/arsenal-vs-chelsea-68500351): everything about one match — header with score
// or kick-off, every market, stats (chances implied by the odds, what players are picking, live
// stats and timeline) and more matches from the same league. Odds keep updating from the feed.
// Head-to-head, form, tables and line-ups arrive with a real data provider (not shown until then).
import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type TCMatch, codeFromMatchSlug, dayLabel, hhmm, leagueSlug, matchCode, matchHref } from "./data";
import { CheckIcon, ChevronLeft, ChevronRight, ShareIcon } from "./icons";
import { Crest, Flag } from "./media";
import { LiveChat, MatchView } from "./matchview";
import { ChanceAndPicks, LiveStats, Timeline } from "./matchstats";
import { ACCENT, Loader1X2, MatchMarkets, canGoBack, publicOrigin, shareText, useMinLoading } from "./shared";

const card: CSSProperties = { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14 };
// Phones: sections run the full width of the screen (no rounded corners or side borders), like
// BetKing; the page's 16px side padding is cancelled out. Desktop keeps rounded cards.
const flat: CSSProperties = { background: "var(--tc-card)", borderTop: "1px solid var(--tc-card-line)", borderBottom: "1px solid var(--tc-card-line)", margin: "0 -16px" };
const sectionTitle: CSSProperties = { margin: "0 0 12px", fontSize: 15, fontWeight: 800 };
const barlow = "'Barlow Condensed', sans-serif";

export function MatchPage({ matches, loaded, desktop = false }: { matches: TCMatch[]; loaded: boolean; desktop?: boolean }) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const code = codeFromMatchSlug(slug);
  const m = code ? matches.find((x) => matchCode(x.id) === code) : undefined;
  const busy = useMinLoading(!m && !loaded);
  const [tab, setTab] = useState<"markets" | "stats">("markets");
  useEffect(() => { window.scrollTo(0, 0); setTab("markets"); }, [code]);

  const box = desktop ? card : flat;
  const go = (href: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(href); };
  const back = () => (canGoBack() ? navigate(-1) : navigate("/"));

  if (busy) return <Loader1X2 label="Loading match…" />;
  if (!m) {
    return (
      <div style={{ ...box, padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>This match isn't on the board</h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)" }}>It may have finished, or the link is wrong. Today's matches are on the home page.</p>
        <a href="/" onClick={go("/")} style={{ height: 44, padding: "0 22px", borderRadius: 10, background: ACCENT, color: "#13171C", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", textDecoration: "none" }}>See today's matches</a>
      </div>
    );
  }

  // Phones: every market its own full-width section with a gutter between; desktop: one card.
  const markets = desktop ? <div style={{ ...box, padding: 16 }}><MatchMarkets m={m} desktop /></div> : <MatchMarkets m={m} section={flat} />;
  const more = matches.filter((x) => x.league === m.league && x.country === m.country && x.id !== m.id).sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start).slice(0, 6);
  const tabBtn = (id: "markets" | "stats", label: string) => (
    <button role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{
      flex: desktop ? "none" : 1, height: 44, padding: desktop ? "0 18px" : 0, border: "none", background: "transparent",
      borderBottom: `2px solid ${tab === id ? ACCENT : "transparent"}`, color: tab === id ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 15, fontWeight: tab === id ? 800 : 700,
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: desktop ? 14 : 8, minWidth: 0, flex: 1 }}>
      {/* Back + where this match belongs */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--tc-label)", minWidth: 0 }}>
        <button onClick={back} aria-label="Back" style={{ width: 36, height: 36, marginLeft: -8, border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ChevronLeft size={18} />
        </button>
        <a href="/sports/football" onClick={go("/sports/football")} style={{ color: "var(--tc-label)", textDecoration: "none" }}>Football</a>
        <ChevronRight size={12} />
        <a href={`/league/${leagueSlug(m.country, m.league)}`} onClick={go(`/league/${leagueSlug(m.country, m.league)}`)}
          style={{ color: "var(--tc-soft)", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.league}</a>
      </div>

      <MatchHeader m={m} box={box} />
      {m.live && (m.momentum?.length ?? 0) > 0 ? <>
        {/* Live: match view with Pitch / Stats / Timeline / Commentary / Line-ups, live chat, then the markets. */}
        <MatchView m={m} flat={!desktop} />
        <LiveChat m={m} flat={!desktop} />
        {markets}
      </> : <>
        <div role="tablist" style={{ display: "flex", borderBottom: "1px solid var(--tc-line)" }}>
          {tabBtn("markets", "Markets")}
          {tabBtn("stats", m.live ? "Stats & timeline" : "Stats")}
        </div>
        {tab === "markets" ? markets : (
          desktop ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {m.live && <><Timeline m={m} boxed /><LiveStats m={m} boxed /></>}
              <ChanceAndPicks m={m} boxed />
            </div>
          ) : (
            <div style={{ ...box, padding: "12px 16px" }}>
              {m.live && <><Timeline m={m} /><LiveStats m={m} /></>}
              <ChanceAndPicks m={m} />
            </div>
          )
        )}
      </>}

      {more.length > 0 && (
        <section aria-label={`More from ${m.league}`} style={{ ...box, overflow: "hidden" }}>
          <h2 style={{ ...sectionTitle, margin: 0, padding: "14px 16px 10px" }}>More from {m.league}</h2>
          {more.map((x) => (
            <a key={x.id} href={matchHref(x)} onClick={go(matchHref(x))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--tc-line)", color: "var(--tc-text)", textDecoration: "none" }}>
              <span style={{ width: 52, flexShrink: 0, fontSize: 12, fontWeight: 800, color: x.live ? "#E5484D" : "var(--tc-soft)" }}>{x.live ? x.clock : `${dayLabel(x.start)} ${hhmm(x.start)}`}</span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                {([[x.home, x.homeLogo, x.hs], [x.away, x.awayLogo, x.as]] as const).map(([name, logo, goals]) => (
                  <span key={name} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Crest name={name} url={logo} size={18} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                    {x.live && <span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>{goals}</span>}
                  </span>
                ))}
              </span>
              <span style={{ color: "var(--tc-faint)", display: "flex" }}><ChevronRight /></span>
            </a>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------- header: league, crests, score or kick-off, match ID, share ----------
function MatchHeader({ m, box }: { m: TCMatch; box: CSSProperties }) {
  const [shared, setShared] = useState(false);
  const share = async () => {
    const when = m.live ? `Live now, ${m.hs}-${m.as} (${m.clock})` : `${dayLabel(m.start)} ${hhmm(m.start)}`;
    const r = await shareText(`${m.home} vs ${m.away} · ${m.league}\n${when}\nOdds on Poccabet:`, `${publicOrigin()}${matchHref(m)}`);
    if (r !== "failed") { setShared(true); setTimeout(() => setShared(false), 1600); }
  };
  const team = (name: string, logo: string, red: boolean) => (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
      <Crest name={name} url={logo} size={56} fontSize={15} />
      <span style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: "100%" }}>
        <span style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {red && <span aria-label="Red card" style={{ flexShrink: 0, width: 9, height: 12, borderRadius: 2, background: "#E5484D" }} />}
      </span>
    </div>
  );
  return (
    <header style={{ ...box, padding: "16px 16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <Flag country={m.country} size={14} />{m.country ? `${m.country} · ` : ""}{m.league}
        </span>
        {m.live && <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, color: "#E5484D", fontWeight: 800 }}>
          <span style={{ width: 7, height: 7, borderRadius: 4, background: "#E5484D" }} />LIVE
        </span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {team(m.home, m.homeLogo, m.red === "home")}
        <div style={{ flexShrink: 0, minWidth: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          {m.live ? <>
            <span style={{ fontFamily: barlow, fontSize: 40, fontWeight: 700, lineHeight: 1 }}>{m.hs} – {m.as}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: m.clock === "HT" ? "var(--tc-muted)" : "#E5484D" }}>{m.clock === "HT" ? "Half time" : m.clock}</span>
          </> : <>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tc-label)" }}>{dayLabel(m.start)}</span>
            <span style={{ fontFamily: barlow, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{hhmm(m.start)}</span>
          </>}
        </div>
        {team(m.away, m.awayLogo, m.red === "away")}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTop: "1px solid var(--tc-line)" }}>
        <span style={{ fontSize: 12, color: "var(--tc-label)" }}>Match ID <strong title="Match ID" style={{ color: ACCENT, fontWeight: 800, letterSpacing: 0.3 }}>{matchCode(m.id)}</strong></span>
        <button onClick={share} style={{ height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--tc-outline-2)", background: "transparent", color: shared ? "#2AB572" : "var(--tc-text)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800 }}>
          {shared ? <><CheckIcon size={15} />Shared</> : <><ShareIcon size={15} />Share</>}
        </button>
      </div>
    </header>
  );
}
