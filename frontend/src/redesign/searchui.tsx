// Search on screen: suggestions while typing (desktop dropdown under the header box, full-screen
// on phones) and the results page (/search?q=…). The matching itself is in search.ts.
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type TCMatch, TOP_LEAGUES, kickoff } from "./data";
import { ChevronLeft, ChevronRight, CloseIcon, SearchIcon } from "./icons";
import { Crest, Flag } from "./media";
import { type ListViewProps, MatchListPage } from "./mobile";
import {
  type SearchIndex, clearRecentSearches, highlightParts, normalize, recentSearches, rememberSearch, search, searchMatches,
} from "./search";
import { POPULAR_CLUBS } from "./potd";
import { ACCENT } from "./shared";

const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
export const searchHref = (q: string) => `/search?q=${encodeURIComponent(q.trim())}`;

function Hl({ text, query }: { text: string; query: string }) {
  return <>{highlightParts(text, query).map((p, i) => p.hit ? <strong key={i} style={{ color: "var(--tc-text)", fontWeight: 800 }}>{p.text}</strong> : <span key={i}>{p.text}</span>)}</>;
}

type Item = { key: string; section: string; run: () => void; render: (active: boolean) => ReactNode };

// Suggestions, keyboard selection and what picking each one does.
function useSearchUI(index: SearchIndex, onOpenMatch: (m: TCMatch) => void, onDone: () => void) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { setRecent(recentSearches()); }, []);
  const q = query.trim();
  const results = useMemo(() => search(index, q), [index, q]);

  const go = (label: string, fn: () => void) => { rememberSearch(label); setRecent(recentSearches()); fn(); onDone(); };
  const submit = (text = q) => { if (normalize(text)) go(text, () => navigate(searchHref(text))); };

  const row = (icon: ReactNode, title: ReactNode, sub: ReactNode, right?: ReactNode) => (active: boolean) => (
    <span style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "6px 14px", background: active ? "var(--tc-raise)" : "transparent", borderRadius: 10 }}>
      <span style={{ width: 30, flexShrink: 0, display: "flex", justifyContent: "center" }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--tc-soft)", ...ellipsis }}>{title}</span>
        <span style={{ fontSize: 12, color: "var(--tc-label)", ...ellipsis }}>{sub}</span>
      </span>
      {right}
    </span>
  );
  const liveTag = (m: TCMatch) => <span style={{ fontSize: 12, fontWeight: 800, color: m.clock === "HT" ? "var(--tc-muted)" : "#E5484D", flexShrink: 0 }}>{m.clock}</span>;

  const items: Item[] = [];
  if (q) {
    for (const { m } of results.live) items.push({
      key: `live-${m.id}`, section: "Live now", run: () => go(q, () => onOpenMatch(m)),
      render: row(<Crest name={m.home} url={m.homeLogo} size={26} />,
        <><Hl text={m.home} query={q} /> <span style={{ color: "var(--tc-text)", fontWeight: 800 }}>{m.hs}–{m.as}</span> <Hl text={m.away} query={q} /></>,
        <><Hl text={m.league} query={q} />{m.country ? ` · ${m.country}` : ""}</>, liveTag(m)),
    });
    for (const t of results.teams) items.push({
      key: `team-${t.name}`, section: "Teams", run: () => go(t.name, () => navigate(searchHref(t.name))),
      render: row(<Crest name={t.name} url={t.logo} size={28} />, <Hl text={t.name} query={q} />,
        t.live ? <span style={{ color: "#E5484D", fontWeight: 700 }}>LIVE {t.live.clock} · {t.live.home} {t.live.hs}–{t.live.as} {t.live.away}</span>
          : t.next ? `Next: ${t.next.home === t.name ? `vs ${t.next.away}` : `at ${t.next.home}`} · ${kickoff(t.next.start)}`
          : `${t.league}${t.country ? ` · ${t.country}` : ""}`,
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-label)", flexShrink: 0 }}>{t.count} match{t.count === 1 ? "" : "es"}</span>),
    });
    for (const l of results.leagues) items.push({
      key: `league-${l.slug}`, section: "Leagues", run: () => go(l.name, () => navigate(`/league/${l.slug}`)),
      render: row(<Flag country={l.country} size={22} />, <Hl text={l.name} query={q} />,
        <>{l.country ? <><Hl text={l.country} query={q} /> · </> : ""}{l.count} match{l.count === 1 ? "" : "es"}{l.live ? <span style={{ color: "#E5484D", fontWeight: 700 }}> · {l.live} live</span> : ""}</>,
        <span style={{ color: "var(--tc-faint)", display: "flex" }}><ChevronRight /></span>),
    });
    for (const { m } of results.upcoming) items.push({
      key: `up-${m.id}`, section: "Matches", run: () => go(q, () => onOpenMatch(m)),
      render: row(<Crest name={m.home} url={m.homeLogo} size={26} />, <><Hl text={m.home} query={q} /> vs <Hl text={m.away} query={q} /></>,
        <><Hl text={m.league} query={q} />{m.country ? ` · ${m.country}` : ""}</>,
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-soft)", flexShrink: 0 }}>{kickoff(m.start)}</span>),
    });
    items.push({
      key: "all", section: "", run: () => submit(),
      render: (a) => (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 48, borderRadius: 10, background: a ? "var(--tc-raise)" : "transparent", color: ACCENT, fontSize: 14, fontWeight: 800 }}>
          <SearchIcon />{results.total ? `See all ${results.total} match${results.total === 1 ? "" : "es"} for “${q}”` : `Search for “${q}”`}
        </span>
      ),
    });
  }
  useEffect(() => setActive(-1), [q]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(-1, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0 && items[active]) items[active].run(); else submit(); }
    else if (e.key === "Escape") onDone();
  };

  // Before typing: recent searches and popular picks from today's feed.
  const popular = [
    ...index.leagues.filter((l) => TOP_LEAGUES.includes(l.name)).sort((a, b) => TOP_LEAGUES.indexOf(a.name) - TOP_LEAGUES.indexOf(b.name)).slice(0, 4).map((l) => l.name),
    ...index.teams.filter((t) => POPULAR_CLUBS.includes(t.name)).slice(0, 6).map((t) => t.name),
  ];
  const clearRecent = () => { clearRecentSearches(); setRecent([]); };
  return { query, setQuery, items, active, setActive, onKeyDown, submit, recent, popular, clearRecent, resultsEmpty: !!q && items.length === 1 && !results.total };
}

function Chip({ label, onPick }: { label: string; onPick: () => void }) {
  return (
    <button onMouseDown={(e) => e.preventDefault()} onClick={onPick} style={{ height: 36, padding: "0 14px", borderRadius: 18, border: "1px solid var(--tc-outline-2)", background: "transparent", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</button>
  );
}

function Suggestions({ ui, listId }: { ui: ReturnType<typeof useSearchUI>; listId: string }) {
  if (!ui.query.trim()) {
    const block = (title: string, list: string[], extra?: ReactNode) => list.length > 0 && (
      <div style={{ padding: "12px 14px 4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--tc-label)" }}>{title}</span>{extra}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{list.map((s) => <Chip key={s} label={s} onPick={() => ui.submit(s)} />)}</div>
      </div>
    );
    return (
      <div style={{ paddingBottom: 12 }}>
        {block("RECENT SEARCHES", ui.recent,
          <button onMouseDown={(e) => e.preventDefault()} onClick={ui.clearRecent} style={{ border: "none", background: "transparent", color: ACCENT, fontFamily: "inherit", fontSize: 12, fontWeight: 800, padding: 4 }}>Clear</button>)}
        {block("POPULAR", ui.popular)}
        {!ui.recent.length && !ui.popular.length && <p style={{ margin: 0, padding: "18px 14px", fontSize: 13, color: "var(--tc-label)" }}>Search teams, leagues, countries and live games.</p>}
      </div>
    );
  }
  let last = "";
  return (
    <div id={listId} role="listbox" aria-label="Suggestions" style={{ padding: "6px 6px 8px" }}>
      {ui.resultsEmpty && <p style={{ margin: 0, padding: "14px 14px 6px", fontSize: 13, color: "var(--tc-label)" }}>No teams, leagues or matches match “{ui.query.trim()}”.</p>}
      {ui.items.map((it, i) => {
        const head = it.section && it.section !== last ? it.section : "";
        last = it.section || last;
        return (
          <div key={it.key}>
            {head && <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--tc-label)" }}>{head.toUpperCase()}</div>}
            <div id={`${listId}-${i}`} role="option" aria-selected={i === ui.active} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => ui.setActive(i)} onClick={it.run} style={{ cursor: "pointer" }}>
              {it.render(i === ui.active)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- desktop: header box with a dropdown ----------
export function DesktopSearch({ index, onOpenMatch }: { index: SearchIndex; onOpenMatch: (m: TCMatch) => void }) {
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ui = useSearchUI(index, onOpenMatch, () => { setOpen(false); input.current?.blur(); });
  const listId = useId();
  // "/" jumps to the search box (unless you're already typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="tc-dsearch" style={{ position: "relative", width: 320 }}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); ui.submit(); }} style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 12px", borderRadius: 10, background: "var(--tc-raise)", color: "var(--tc-label)", boxSizing: "border-box", border: `1px solid ${open ? "var(--tc-outline-strong)" : "transparent"}` }}>
        <SearchIcon />
        <input suppressHydrationWarning ref={input} type="search" value={ui.query} placeholder="Search teams, leagues, live games"
          role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={ui.active >= 0 ? `${listId}-${ui.active}` : undefined}
          onChange={(e) => { ui.setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={ui.onKeyDown}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 14 }} />
        {!open && !ui.query && <kbd aria-hidden="true" style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: "var(--tc-faint)", border: "1px solid var(--tc-outline)", borderRadius: 5, padding: "1px 6px" }}>/</kbd>}
        <button type="submit" aria-label="Search" onMouseDown={(e) => e.preventDefault()} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: ui.query ? "var(--tc-accent)" : "transparent", color: ui.query ? "var(--tc-on-accent)" : "var(--tc-label)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={16} />
        </button>
      </form>
      {open && (
        <div style={{ position: "absolute", top: 46, right: 0, width: 460, maxHeight: "min(72vh, 620px)", overflowY: "auto", background: "var(--tc-panel)", border: "1px solid var(--tc-line)", borderRadius: 14, boxShadow: "0 18px 48px rgba(0,0,0,0.45)", zIndex: 50 }}>
          <Suggestions ui={ui} listId={listId} />
        </div>
      )}
    </div>
  );
}

// ---------- phones: header button that opens a full-screen search ----------
export function MobileSearchButton({ index, onOpenMatch }: { index: SearchIndex; onOpenMatch: (m: TCMatch) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button aria-label="Search" onClick={() => setOpen(true)} style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 19, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SearchIcon size={18} />
      </button>
      {/* Rendered on <body>: the sticky header would otherwise keep it under the bottom nav. */}
      {open && createPortal(<MobileSearch index={index} onOpenMatch={onOpenMatch} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function MobileSearch({ index, onOpenMatch, onClose }: { index: SearchIndex; onOpenMatch: (m: TCMatch) => void; onClose: () => void }) {
  const ui = useSearchUI(index, onOpenMatch, onClose);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="tc-root" role="dialog" aria-modal="true" aria-label="Search" style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--tc-page)", display: "flex", flexDirection: "column" }}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); ui.submit(); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "calc(10px + env(safe-area-inset-top)) 12px 10px 4px", borderBottom: "1px solid var(--tc-line)", background: "var(--tc-header)" }}>
        <button type="button" aria-label="Close search" onClick={onClose} style={{ width: 44, height: 44, flexShrink: 0, border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={20} />
        </button>
        <label style={{ flex: 1, minWidth: 0, height: 46, display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 12px", borderRadius: 12, background: "var(--tc-raise)", color: "var(--tc-label)" }}>
          <SearchIcon size={18} />
          <input suppressHydrationWarning ref={input} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false} value={ui.query} placeholder="Teams, leagues, live games"
            role="combobox" aria-expanded={!!ui.query} aria-controls={listId} aria-autocomplete="list"
            onChange={(e) => ui.setQuery(e.target.value)} onKeyDown={ui.onKeyDown}
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 16 }} />
          {ui.query && (
            <button type="button" aria-label="Clear" onClick={() => { ui.setQuery(""); input.current?.focus(); }} style={{ width: 36, height: 36, border: "none", background: "transparent", color: "var(--tc-label)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CloseIcon size={16} />
            </button>
          )}
        </label>
      </form>
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <Suggestions ui={ui} listId={listId} />
      </div>
    </div>
  );
}

// ---------- results page: /search?q=… ----------
type PageProps = Omit<ListViewProps, "title" | "sub" | "country" | "liveList" | "upList" | "group" | "resetKey"> & {
  index: SearchIndex; View?: ComponentType<ListViewProps>;
};
export function SearchResultsPage({ index, View = MatchListPage, ...rest }: PageProps) {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const { live, upcoming } = useMemo(() => searchMatches(index, q), [index, q]);
  return <View title={q ? `“${q}”` : "Search"} sub="Search results" liveList={live} upList={upcoming} group="league" resetKey={q} {...rest} />;
}
