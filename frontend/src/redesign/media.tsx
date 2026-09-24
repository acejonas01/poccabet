// Imagery for Theme C: promo slider, hot-games strip, country flags.
import { useEffect, useRef, useState } from "react";
import { teamCode } from "./data";
import { ChevronLeft, ChevronRight } from "./icons";
import { ACCENT } from "./shared";

// ---------- promo slider (1080×400 mobile artwork; 2120×400 wide artwork on desktop) ----------
// Infinite loop: three copies of the slides side by side; you always sit in the middle copy.
// After any scroll settles outside it, we jump (instantly, invisibly) to the same slide in the
// middle copy — so autoplay glides from slide 5 to slide 1 and swipes never hit an end.
const SLIDES = [1, 2, 3, 4, 5].map((i) => `/slides/Slide-${i}-m.jpg`);
const WIDE = [1, 2, 3, 4, 5].map((i) => `/slides/Slide-${i}.jpg`);
const N = SLIDES.length;
const GAP = 10;

export function PromoSlider({ desktop = false }: { desktop?: boolean }) {
  const slides = desktop ? WIDE : SLIDES;
  const LOOP = [...slides, ...slides, ...slides];
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pos = useRef(N); // index into LOOP of the slide in view
  const pausedUntil = useRef(0);

  const step = () => {
    const first = track.current?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + GAP : 1;
  };
  const go = (i: number, smooth = true) => {
    pos.current = i;
    track.current?.scrollTo({ left: i * step(), behavior: smooth ? "smooth" : "instant" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    go(N, false); // start on slide 1 of the middle copy

    let settle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / step());
      pos.current = i;
      setActive(((i % N) + N) % N);
      clearTimeout(settle);
      settle = setTimeout(() => {
        const j = Math.round(el.scrollLeft / step());
        if (j < N || j >= 2 * N) go((((j % N) + N) % N) + N, false);
      }, 140);
    };
    const pause = () => { pausedUntil.current = Date.now() + 8000; };
    const resize = () => go(pos.current, false);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", pause);
    el.addEventListener("touchstart", pause, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      clearTimeout(settle);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Autoplay every 5s, always forward; skips while the tab is hidden or just after a swipe.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil.current) return;
      go(pos.current + 1);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const arrow = (dir: -1 | 1) => (
    <button aria-label={dir < 0 ? "Previous promotion" : "Next promotion"}
      onClick={() => { pausedUntil.current = Date.now() + 8000; go(pos.current + dir); }}
      style={{ position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 12, transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(12, 21, 26, 0.7)", color: "#F2F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {dir < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
    </button>
  );

  return (
    <section aria-label="Promotions" style={{ marginTop: desktop ? 0 : 14 }}>
      <div style={{ position: "relative" }}>
      <div ref={track} className="tc-hscroll" style={{ display: "flex", gap: GAP, overflowX: "auto", padding: desktop ? 0 : "0 16px", scrollSnapType: "x mandatory", scrollPaddingLeft: desktop ? 0 : 16 }}>
        {LOOP.map((src, i) => (
          <a key={i} href="#" onClick={(e) => e.preventDefault()} aria-label={`Promotion ${(i % N) + 1}`}
            aria-hidden={i < N || i >= 2 * N ? true : undefined} tabIndex={i < N || i >= 2 * N ? -1 : undefined}
            style={{
              flex: desktop ? "0 0 100%" : "0 0 calc(100% - 24px)", scrollSnapAlign: "start", aspectRatio: desktop ? "2120 / 400" : "1080 / 400", borderRadius: 14,
              overflow: "hidden", border: "1px solid var(--tc-card-line)", background: "var(--tc-card)", display: "block",
            }}>
            <img src={src} alt="" loading={i === N || i === N + 1 ? "eager" : "lazy"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        ))}
      </div>
      {desktop && <>{arrow(-1)}{arrow(1)}</>}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <button key={i} aria-label={`Go to promotion ${i + 1}`} aria-current={i === active ? "true" : undefined}
            onClick={() => {
              pausedUntil.current = Date.now() + 8000;
              // Move to that slide within the copy currently in view.
              const base = pos.current - (((pos.current % N) + N) % N);
              go(base + i);
            }}
            style={{ width: i === active ? 18 : 6, height: 6, padding: 0, border: "none", borderRadius: 3, background: i === active ? ACCENT : "var(--tc-track)", transition: "width 0.25s" }} />
        ))}
      </div>
    </section>
  );
}

// ---------- hot games strip ----------
const GAMES = [
  { name: "Aviator", tag: "₦1,000,000 free bet", img: "/games/aviator.jpg" },
  { name: "Gigahot 40", tag: "Slots", img: "/games/gigahot-40.jpg" },
  { name: "Mines", tag: "Poccabet Originals", img: "/games/mines.jpg" },
  { name: "Multi Hot 5", tag: "Slots", img: "/games/multi-hot-5.jpg" },
  { name: "Poccabet Spin", tag: "Exclusive", img: "/games/poccabet-spin.jpg" },
];

export function HotGamesStrip() {
  return (
    <section aria-label="Hot games" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 10px" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Hot games</h2>
        <a href="#" onClick={(e) => e.preventDefault()} style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
          View all<ChevronRight />
        </a>
      </div>
      <div className="tc-hscroll" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 4px", scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        {GAMES.map((g) => (
          <a key={g.name} href="#" onClick={(e) => e.preventDefault()} style={{ flex: "0 0 148px", scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: 6, textDecoration: "none", color: "var(--tc-text)" }}>
            <span style={{ display: "block", aspectRatio: "300 / 190", borderRadius: 12, overflow: "hidden", border: "1px solid var(--tc-card-line)", background: "var(--tc-card)" }}>
              <img src={g.img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 2px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: g.tag.includes("₦") ? ACCENT : "var(--tc-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.tag}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ---------- country flags (flagcdn.com) ----------
const FLAG_CODES: Record<string, string> = {
  england: "gb-eng", scotland: "gb-sct", wales: "gb-wls", "northern ireland": "gb-nir", "united kingdom": "gb",
  spain: "es", italy: "it", germany: "de", france: "fr", nigeria: "ng", europe: "eu", portugal: "pt",
  netherlands: "nl", belgium: "be", turkey: "tr", brazil: "br", argentina: "ar", usa: "us", "united states": "us",
  mexico: "mx", japan: "jp", "south korea": "kr", "korea republic": "kr", ukraine: "ua", russia: "ru", greece: "gr",
  austria: "at", switzerland: "ch", denmark: "dk", sweden: "se", norway: "no", poland: "pl", croatia: "hr",
  serbia: "rs", "czech republic": "cz", romania: "ro", ghana: "gh", "south africa": "za", egypt: "eg",
  morocco: "ma", kenya: "ke", cameroon: "cm", "ivory coast": "ci", senegal: "sn", australia: "au", china: "cn",
  india: "in", "saudi arabia": "sa", colombia: "co", chile: "cl", peru: "pe", uruguay: "uy", ecuador: "ec",
  "bosnia and herzegovina": "ba", bosnia: "ba", "north macedonia": "mk", slovenia: "si", slovakia: "sk",
  hungary: "hu", bulgaria: "bg", ireland: "ie", iceland: "is", finland: "fi", canada: "ca",
};

export function Flag({ country, size = 16 }: { country: string; size?: number }) {
  const code = FLAG_CODES[country.trim().toLowerCase()];
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt=""
      width={size}
      height={Math.round(size * 0.7)}
      loading="lazy"
      style={{ flexShrink: 0, borderRadius: 2, objectFit: "cover", boxShadow: "0 0 0 1px rgba(255,255,255,0.08)" }}
    />
  );
}

// ---------- team crests (falls back to the design's 3-letter badge) ----------
export function Crest({ name, url, size, fontSize = 12 }: { name: string; url: string; size: number; fontSize?: number }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)}
        style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }} />
    );
  }
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: size / 2, background: "var(--tc-crest-bg)", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 800, letterSpacing: 0.5,
    }}>{size >= 30 ? teamCode(name) : ""}</span>
  );
}
