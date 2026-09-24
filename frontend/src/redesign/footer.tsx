// Grand Prize Winners + site footer for the redesign (Themes A, B and C).
import { useEffect, useState, type ReactElement } from "react";
import { api } from "../api/client";
import { ACCENT } from "./shared";
import { AviatorIcon, CasinoIcon, ChevronRight, JackpotIcon, SportsIcon, VirtualsIcon } from "./icons";

// ---------- Grand Prize Winners ----------
// Demo mode shows simulated wins; live mode shows real winning bets only, and the whole
// section hides itself when there are none (never padded with made-up winners).
// Layout: the biggest recent win as a hero card (stake → multiplier → payout), then the
// rest drifting past in a slow ticker that pauses under your finger.
interface Winner { id: string; player: string; amount: number; stake?: number; product: string; detail?: string; at: string }

const WIN_GREEN = "#5BD679";
const naira = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const multLabel = (m: number) => `${m >= 100 ? Math.round(m) : m.toFixed(1)}x`;
const maskPlayer = (p: string) => p.replace(/^\*+/, "•••• ");
const PRODUCT_ICON: Record<string, (p: { size?: number }) => ReactElement> = { Sports: SportsIcon, Aviator: AviatorIcon, Virtuals: VirtualsIcon, Casino: CasinoIcon };
const display = { fontFamily: "'Barlow Condensed', sans-serif", fontStyle: "italic", fontWeight: 700 } as const;

function ago(at: string, now: number) {
  const mins = Math.max(1, Math.round((now - new Date(at).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

function ProductBadge({ product, size }: { product: string; size: number }) {
  const Icon = PRODUCT_ICON[product] ?? JackpotIcon;
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, borderRadius: size / 2, background: "var(--tc-raise)", color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon size={Math.round(size * 0.52)} />
    </span>
  );
}

function BiggestWin({ w, now }: { w: Winner; now: number }) {
  return (
    <div style={{
      margin: "0 16px", padding: 16, borderRadius: 14, border: "1px solid rgba(245, 197, 24, 0.3)",
      background: "radial-gradient(120% 100% at 100% 0%, rgba(245, 197, 24, 0.14), transparent 60%), var(--tc-card)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 1.2 }}><JackpotIcon size={14} />BIGGEST WIN</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--tc-label)" }}>{ago(w.at, now)}</span>
      </div>
      <span style={{ ...display, fontSize: 40, lineHeight: 1, color: WIN_GREEN, whiteSpace: "nowrap" }}>{naira(w.amount)}</span>
      {w.stake ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--tc-muted)" }}>
          <span>{naira(w.stake).replace(".00", "")} stake</span>
          <ChevronRight size={12} />
          <span style={{ ...display, fontSize: 16, padding: "1px 8px", borderRadius: 6, background: ACCENT, color: "#13171C" }}>{multLabel(w.amount / w.stake)}</span>
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid var(--tc-card-line)" }}>
        <ProductBadge product={w.product} size={32} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{w.product}</span>
          {w.detail && <span style={{ fontSize: 12, color: "var(--tc-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.detail}</span>}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-soft)" }}>{maskPlayer(w.player)}</span>
      </div>
    </div>
  );
}

function WinTile({ w, now }: { w: Winner; now: number }) {
  return (
    <div style={{ flex: "0 0 auto", width: 200, marginRight: 10, padding: "12px 14px", borderRadius: 12, background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", display: "flex", alignItems: "center", gap: 10 }}>
      <ProductBadge product={w.product} size={36} />
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ ...display, fontSize: 20, lineHeight: 1.1, color: WIN_GREEN, whiteSpace: "nowrap" }}>{naira(w.amount)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-soft)", whiteSpace: "nowrap" }}>
          {w.stake ? `${multLabel(w.amount / w.stake)} · ` : ""}{w.product}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tc-label)" }}>{ago(w.at, now)}</span>
      </div>
    </div>
  );
}

export function WinnersStrip() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () => api.getWinners().then((r) => setWinners(r.winners)).catch(() => {});
    load();
    const poll = setInterval(load, 60000);
    const tick = setInterval(() => setNow(Date.now()), 30000); // keep "x min ago" fresh
    return () => { clearInterval(poll); clearInterval(tick); };
  }, []);

  if (!winners.length) return null;
  const top = winners.reduce((a, b) => (b.amount > a.amount ? b : a));
  const rest = winners.filter((w) => w !== top);

  return (
    <section aria-label="Grand prize winners" style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, padding: "0 16px", fontSize: 17, fontWeight: 800 }}>Grand Prize Winners</h2>
      <BiggestWin w={top} now={now} />
      {rest.length > 0 && (
        <div className="tc-marquee-wrap" style={{ overflow: "hidden", padding: "0 16px" }}>
          {/* Two copies side by side; the track slides by exactly one copy, then repeats. */}
          <div className="tc-marquee" style={{ ["--tc-marquee-dur" as string]: `${rest.length * 4}s` }}>
            <div style={{ display: "flex" }}>{rest.map((w) => <WinTile key={w.id} w={w} now={now} />)}</div>
            <div className="tc-marquee-dup" aria-hidden="true" style={{ display: "flex" }}>{rest.map((w) => <WinTile key={w.id} w={w} now={now} />)}</div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- footer ----------
const LINKS = ["Sports", "Live", "Become an agent", "About us", "Contact us", "Help", "Affiliates", "T&Cs", "Privacy policy"];
const SOCIALS = [
  { label: "Facebook", d: "M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" },
  { label: "X", d: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64Z" },
  { label: "Instagram", d: "M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.89 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm4.33-7.06a.97.97 0 1 0 0-1.95.97.97 0 0 0 0 1.95Z" },
  { label: "YouTube", d: "M23.5 6.5a3 3 0 0 0-2.12-2.13C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.38.51A3 3 0 0 0 .5 6.5 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.5 3 3 0 0 0 2.12 2.13c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3 3 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.5ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" },
];

export function SiteFooter() {
  return (
    <footer style={{ marginTop: 28, padding: "24px 16px 20px", background: "var(--tc-panel)", borderTop: "1px solid var(--tc-line)", display: "flex", flexDirection: "column", gap: 18 }}>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontStyle: "italic", fontWeight: 700, fontSize: 28, lineHeight: 1 }}>
        Pocca<span style={{ color: ACCENT }}>bet</span>
      </span>
      <nav aria-label="Footer" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px 16px" }}>
        {LINKS.map((l) => (
          <a key={l} href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 14, fontWeight: 600, color: "var(--tc-muted)", textDecoration: "none" }}>{l}</a>
        ))}
      </nav>
      <div style={{ display: "flex", gap: 10 }}>
        {SOCIALS.map((s) => (
          <a key={s.label} href="#" aria-label={s.label} onClick={(e) => e.preventDefault()} style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid var(--tc-outline)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tc-muted)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={s.d} /></svg>
          </a>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
        <span style={{ width: 34, height: 34, borderRadius: 17, border: "2px solid #E5484D", color: "#E5484D", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>18+</span>
        Play responsibly
      </div>
      <p style={{ margin: 0, paddingTop: 14, borderTop: "1px solid var(--tc-line)", fontSize: 12, lineHeight: 1.5, color: "var(--tc-label)" }}>
        © {new Date().getFullYear()} Poccabet Technologies Ltd. is regulated by the National Lottery Regulatory Commission.
      </p>
    </footer>
  );
}
