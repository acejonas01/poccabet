// Imagery for Theme C: promo slider, hot-games strip, country flags.
import { useEffect, useRef, useState } from "react";
import { teamCode } from "./data";
import { ChevronRight } from "./icons";
import { ACCENT } from "./shared";

// ---------- promo slider (uses the 1080×400 mobile artwork) ----------
const SLIDES = [1, 2, 3, 4, 5].map((i) => `/slides/Slide-${i}-m.jpg`);
const GAP = 10;

export function PromoSlider() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);

  const step = () => {
    const first = track.current?.firstElementChild as HTMLElement | null;
    return first ? first.offsetWidth + GAP : 1;
  };
  const go = (i: number) => track.current?.scrollTo({ left: i * step(), behavior: "smooth" });

  // Follow manual swipes.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setActive(Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / step())));
    const pause = () => { pausedUntil.current = Date.now() + 8000; };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", pause);
    el.addEventListener("touchstart", pause, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("touchstart", pause);
    };
  }, []);

  // Autoplay every 5s; skips while the tab is hidden or just after a swipe.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil.current) return;
      setActive((a) => {
        const next = (a + 1) % SLIDES.length;
        go(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section aria-label="Promotions" style={{ marginTop: 14 }}>
      <div ref={track} className="tc-hscroll" style={{ display: "flex", gap: GAP, overflowX: "auto", padding: "0 16px", scrollSnapType: "x mandatory", scrollPaddingLeft: 16 }}>
        {SLIDES.map((src, i) => (
          <a key={src} href="#" onClick={(e) => e.preventDefault()} aria-label={`Promotion ${i + 1}`} style={{
            flex: "0 0 calc(100% - 24px)", scrollSnapAlign: "start", aspectRatio: "1080 / 400", borderRadius: 14,
            overflow: "hidden", border: "1px solid #2A323C", background: "#1C2229", display: "block",
          }}>
            <img src={src} alt="" loading={i === 0 ? "eager" : "lazy"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </a>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {SLIDES.map((_, i) => (
          <button key={i} aria-label={`Go to promotion ${i + 1}`} aria-current={i === active ? "true" : undefined}
            onClick={() => { pausedUntil.current = Date.now() + 8000; setActive(i); go(i); }}
            style={{ width: i === active ? 18 : 6, height: 6, padding: 0, border: "none", borderRadius: 3, background: i === active ? ACCENT : "#33414A", transition: "width 0.25s" }} />
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
          <a key={g.name} href="#" onClick={(e) => e.preventDefault()} style={{ flex: "0 0 148px", scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: 6, textDecoration: "none", color: "#F2F4F6" }}>
            <span style={{ display: "block", aspectRatio: "300 / 190", borderRadius: 12, overflow: "hidden", border: "1px solid #2A323C", background: "#1C2229" }}>
              <img src={g.img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 2px" }}>
              <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: g.tag.includes("₦") ? ACCENT : "#8B95A1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.tag}</span>
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
      width: size, height: size, borderRadius: size / 2, background: "#2A3440", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize, fontWeight: 800, letterSpacing: 0.5,
    }}>{size >= 30 ? teamCode(name) : ""}</span>
  );
}
