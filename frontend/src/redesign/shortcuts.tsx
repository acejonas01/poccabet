// "More" side panel (Shortcuts) and the customer-service sheet, both opened from the quick nav.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { leagueSlug } from "./data";
import { ChevronRight, CloseIcon, HeadsetIcon, VirtualsIcon } from "./icons";
import { Flag, GAMES } from "./media";
import { ACCENT_TEXT, ACCENT, Sheet, SheetTitle } from "./shared";
import { SPORTS } from "./sports";

const LEAGUES = [
  { country: "England", name: "Premier League" },
  { country: "Spain", name: "La Liga" },
  { country: "Italy", name: "Serie A" },
  { country: "Germany", name: "Bundesliga" },
  { country: "France", name: "Ligue 1" },
  { country: "Nigeria", name: "NPFL" },
];
const VIRTUALS = ["Virtual Football League", "Virtual Nations Cup", "Virtual Basketball", "Virtual Horse Racing"];
const TABS = ["Sports", "Games", "Virtuals"] as const;

const sectionTitle = { margin: "0 0 12px", fontSize: 13, fontWeight: 800, letterSpacing: 1, color: "var(--tc-label)" } as const;

// Slides in from the right. Close with ✕, the backdrop, Escape, or a swipe to the right.
export function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Sports");
  const [dx, setDx] = useState(0);
  const [shown, setShown] = useState(false);
  const drag = useRef<{ x: number; y: number; t: number; active: boolean } | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  // One scrolling list: the tabs jump to a section, and the highlighted tab follows the scroll.
  const body = useRef<HTMLDivElement>(null);
  const sections = useRef<Partial<Record<(typeof TABS)[number], HTMLElement | null>>>({});
  const spyPausedUntil = useRef(0);
  const jumpTo = (t: (typeof TABS)[number]) => {
    const el = sections.current[t];
    if (!body.current || !el) return;
    setTab(t);
    spyPausedUntil.current = Date.now() + 700; // don't flicker through tabs during the smooth scroll
    body.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
  };
  const onBodyScroll = () => {
    const b = body.current;
    if (!b || Date.now() < spyPausedUntil.current) return;
    let current: (typeof TABS)[number] = TABS[0];
    for (const t of TABS) if ((sections.current[t]?.offsetTop ?? Infinity) <= b.scrollTop + 40) current = t;
    setTab(current);
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => setShown(true)); // slide in
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => { setShown(false); setTimeout(onClose, 200); };
  const go = (fn: () => void) => { fn(); close(); };

  const onTouchStart = (e: React.TouchEvent) => { drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), active: false }; };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.touches[0].clientX - d.x;
    const my = e.touches[0].clientY - d.y;
    // Only a mostly-horizontal drag to the right moves the panel; vertical drags scroll it.
    if (!d.active && (mx <= 8 || Math.abs(my) > Math.abs(mx))) return;
    d.active = true;
    setDx(Math.max(0, mx));
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    if (dx > 90 || (dx > 40 && Date.now() - d.t < 250)) close();
    else setDx(0);
  };
  const dragging = drag.current?.active;

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,12,15,0.62)", opacity: shown ? 1 : 0, transition: "opacity 0.2s" }} />
      <aside role="dialog" aria-modal="true" aria-label="Shortcuts"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 61, width: "min(76vw, 300px)", display: "flex", flexDirection: "column",
          background: "var(--tc-panel)", boxShadow: "-12px 0 32px rgba(0,0,0,0.4)",
          transform: shown ? `translateX(${dx}px)` : "translateX(100%)", transition: dragging ? "none" : "transform 0.2s ease-out",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "calc(10px + env(safe-area-inset-top)) 8px 6px 20px" }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Shortcuts</span>
          <button ref={closeBtn} aria-label="Close" onClick={close} style={{ width: 44, height: 44, border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={20} />
          </button>
        </div>
        <nav aria-label="Shortcut sections" style={{ display: "flex", gap: 24, padding: "0 20px", borderBottom: "1px solid var(--tc-line)" }}>
          {TABS.map((t) => (
            <button key={t} aria-current={t === tab ? "true" : undefined} onClick={() => jumpTo(t)} style={{
              height: 44, padding: 0, background: "transparent", border: "none", borderBottom: `2px solid ${t === tab ? ACCENT : "transparent"}`,
              color: t === tab ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 15, fontWeight: t === tab ? 800 : 700,
            }}>{t}</button>
          ))}
        </nav>

        <div ref={body} onScroll={onBodyScroll} style={{ position: "relative", flex: 1, overflowY: "auto", overscrollBehavior: "contain", padding: "20px 16px calc(24px + env(safe-area-inset-bottom))" }}>
          <section ref={(el) => { sections.current.Sports = el; }} style={{ scrollMarginTop: 16 }}>
              <h3 style={sectionTitle}>SPORTS</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", rowGap: 18, columnGap: 4 }}>
                {SPORTS.map(({ slug, name, Icon }) => (
                  <button key={slug} onClick={() => go(() => navigate(`/sports/${slug}`))} style={{
                    padding: 0, border: "none", background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    color: "var(--tc-text)", fontSize: 12, fontWeight: 600, lineHeight: 1.25, textAlign: "center",
                  }}>
                    <span style={{ color: "var(--tc-muted)", display: "flex" }}><Icon size={24} /></span>
                    {name}
                  </button>
                ))}
              </div>

              <h3 style={{ ...sectionTitle, marginTop: 24 }}>TOP LEAGUES</h3>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {LEAGUES.map((l) => {
                  const href = `/league/${leagueSlug(l.country, l.name)}`;
                  return (
                    <a key={href} href={href} onClick={(e) => { e.preventDefault(); go(() => navigate(href)); }} style={{
                      minHeight: 48, display: "flex", alignItems: "center", gap: 12, padding: "0 4px", borderBottom: "1px solid var(--tc-line)",
                      color: "var(--tc-text)", textDecoration: "none", fontSize: 14, fontWeight: 700,
                    }}>
                      <Flag country={l.country} size={20} />
                      <span style={{ flex: 1 }}>{l.name}</span>
                      <span style={{ color: "var(--tc-faint)", display: "flex" }}><ChevronRight /></span>
                    </a>
                  );
                })}
              </div>
          </section>

          <section ref={(el) => { sections.current.Games = el; }} style={{ scrollMarginTop: 16, marginTop: 32 }}>
              <h3 style={sectionTitle}>GAMES</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                {GAMES.map((g) => (
                  <a key={g.name} href="#" onClick={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: 6, textDecoration: "none", color: "var(--tc-text)" }}>
                    <span style={{ display: "block", borderRadius: 10, overflow: "hidden", border: "1px solid var(--tc-card-line)", background: "var(--tc-card)" }}>
                      <img src={g.img} alt="" width={600} height={380} loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
                  </a>
                ))}
              </div>
          </section>

          {/* Last section is at least a screen tall, so every tab can scroll its section to the top. */}
          <section ref={(el) => { sections.current.Virtuals = el; }} style={{ scrollMarginTop: 16, marginTop: 32, minHeight: "100%" }}>
              <h3 style={sectionTitle}>VIRTUALS</h3>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {VIRTUALS.map((v) => (
                  <div key={v} style={{ minHeight: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 4px", borderBottom: "1px solid var(--tc-line)", color: "var(--tc-muted)", fontSize: 14, fontWeight: 700 }}>
                    <VirtualsIcon size={22} />
                    <span style={{ flex: 1 }}>{v}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 8, background: "var(--tc-raise)", color: "var(--tc-label)", fontSize: 10, fontWeight: 800 }}>SOON</span>
                  </div>
                ))}
              </div>
          </section>
        </div>
      </aside>
    </>
  );
}

// ---------- customer service ----------
// TODO: replace with the real support channels before launch.
const SUPPORT_EMAIL = "support@poccabet.com";

export function SupportSheet({ onClose }: { onClose: () => void }) {
  const row = { minHeight: 64, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", borderTop: "1px solid var(--tc-line)", color: "var(--tc-text)", textDecoration: "none" } as const;
  const iconBox = { width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: "var(--tc-raise)", color: ACCENT_TEXT, display: "flex", alignItems: "center", justifyContent: "center" } as const;
  return (
    <Sheet label="Customer service" onClose={onClose}>
      <SheetTitle title="Customer service" onClose={onClose} />
      <p style={{ margin: "0 20px 14px", fontSize: 13, color: "var(--tc-muted)" }}>How would you like to reach us?</p>
      <div style={{ ...row, color: "var(--tc-muted)" }}>
        <span style={iconBox}><HeadsetIcon size={20} /></span>
        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Live chat</span>
          <span style={{ fontSize: 12, color: "var(--tc-label)" }}>Chat with an agent</span>
        </span>
        <span style={{ padding: "2px 8px", borderRadius: 8, background: "var(--tc-raise)", color: "var(--tc-label)", fontSize: 10, fontWeight: 800 }}>SOON</span>
      </div>
      <a href={`mailto:${SUPPORT_EMAIL}`} style={row}>
        <span style={iconBox}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
        </span>
        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Email us</span>
          <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{SUPPORT_EMAIL}</span>
        </span>
        <ChevronRight />
      </a>
      <a href="#" onClick={(e) => e.preventDefault()} style={{ ...row, borderBottom: "1px solid var(--tc-line)", marginBottom: 16 }}>
        <span style={iconBox}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.6V14M12 17h.01" /></svg>
        </span>
        <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Help centre</span>
          <span style={{ fontSize: 12, color: "var(--tc-label)" }}>FAQs, deposits, withdrawals</span>
        </span>
        <ChevronRight />
      </a>
    </Sheet>
  );
}
