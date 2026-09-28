// Play responsibly (/responsible-gambling): the 18+ rule, tips, warning signs, what Poccabet can
// do today and where to get help. Information only for now: deposit limits, time-outs and
// self-exclusion come with the licence work, and the page says so.
import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, HeadsetIcon } from "./icons";
import { ACCENT, canGoBack } from "./shared";

const RED = "#E5484D";
const GREEN = "#2AB572";

const TIPS = [
  ["Set a budget before you bet", "Decide what you can afford to lose this week, and stop when it's gone."],
  ["Only bet money you can spare", "Never use money meant for rent, food, school fees or bills."],
  ["Set a time limit", "Decide how long you'll play, and take breaks."],
  ["Don't chase losses", "Trying to win back what you lost usually means losing more."],
  ["Don't bet when upset or drunk", "Stress, anger and alcohol lead to bets you wouldn't normally make."],
  ["Treat winnings as a bonus", "Betting is entertainment, not a way to make a living."],
];

const SIGNS = [
  "You bet more than you planned, or more than you can afford.",
  "You borrow money, sell things or skip bills to keep betting.",
  "You chase losses, trying to win back what you lost.",
  "You hide your betting from family or friends.",
  "You feel anxious, low or irritable when you're not betting.",
  "Betting gets in the way of work, school or the people close to you.",
];

export function ResponsibleGambling({ desktop = false, onSupport }: { desktop?: boolean; onSupport: () => void }) {
  const navigate = useNavigate();
  // Phones: full-width sections on the dark page (like the account page); desktop: cards.
  const box: CSSProperties = desktop
    ? { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 16, padding: 20 }
    : { background: "var(--tc-card)", margin: "0 -16px", padding: "18px 16px" };
  const h2: CSSProperties = { margin: "0 0 12px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, lineHeight: 1.1 };
  const p: CSSProperties = { margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--tc-soft)", maxWidth: "62ch" };
  const list = (items: ReactNode[], mark: (i: number) => ReactNode) => (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((it, i) => <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>{mark(i)}<span style={{ flex: 1 }}>{it}</span></li>)}
    </ul>
  );
  return (
    <div className={desktop ? undefined : "tc-account-page"} style={{ display: "flex", flexDirection: "column", gap: desktop ? 16 : 8, marginTop: desktop ? 0 : -16, maxWidth: desktop ? 760 : undefined }}>
      {/* Header */}
      <header style={{ ...box, display: "flex", flexDirection: "column", gap: 14 }}>
        <button type="button" onClick={() => (canGoBack() ? navigate(-1) : navigate("/account"))} aria-label="Back" style={{ alignSelf: "flex-start", width: 36, height: 36, margin: "-6px 0 -6px -8px", border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span aria-hidden="true" style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 28, border: `3px solid ${RED}`, color: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>18+</span>
          <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontStyle: "italic", fontSize: 34, lineHeight: 1 }}>Play responsibly</h1>
        </div>
        <p style={p}>Betting should be fun, never a way to make money or escape problems. Poccabet is for adults only: you must be <strong style={{ color: "var(--tc-text)" }}>18 or older</strong> to open an account or place a bet, and we check your date of birth when you sign up.</p>
      </header>

      {/* Tips */}
      <section aria-labelledby="rg-tips" style={box}>
        <h2 id="rg-tips" style={h2}>Keep it fun</h2>
        {list(TIPS.map(([t, d]) => <><strong style={{ display: "block", fontSize: 15 }}>{t}</strong><span style={{ fontSize: 14, color: "var(--tc-label)" }}>{d}</span></>),
          () => <span aria-hidden="true" style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, borderRadius: 11, background: "rgba(42, 181, 114, 0.16)", color: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
          </span>)}
      </section>

      {/* Warning signs */}
      <section aria-labelledby="rg-signs" style={box}>
        <h2 id="rg-signs" style={h2}>Is betting becoming a problem?</h2>
        <p style={{ ...p, marginBottom: 14 }}>Be honest with yourself. If any of these sound familiar, it's time to take a break and talk to someone.</p>
        {list(SIGNS.map((t) => <span style={{ fontSize: 14.5 }}>{t}</span>),
          () => <span aria-hidden="true" style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 11, border: `2px solid ${ACCENT}`, color: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>!</span>)}
      </section>

      {/* What Poccabet can do */}
      <section aria-labelledby="rg-tools" style={box}>
        <h2 id="rg-tools" style={h2}>Take a break with Poccabet</h2>
        <p style={p}>If you want to stop for a while or for good, our customer care team can <strong style={{ color: "var(--tc-text)" }}>pause or close your account straight away</strong>. You can still withdraw any money left in it.</p>
        <button type="button" onClick={onSupport} style={{ marginTop: 16, height: 48, padding: "0 18px", borderRadius: 12, border: "none", background: ACCENT, color: "#13171C", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <HeadsetIcon size={20} />Contact customer care
        </button>
        <p style={{ ...p, marginTop: 14, fontSize: 13.5, color: "var(--tc-label)" }}>Coming soon in your account: deposit limits, time-outs (24 hours to 30 days) and self-exclusion.</p>
      </section>

      {/* Help */}
      <section aria-labelledby="rg-help" style={box}>
        <h2 id="rg-help" style={h2}>Get help</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <strong style={{ display: "block", fontSize: 15 }}>Talk to someone you trust</strong>
            <span style={{ fontSize: 14, color: "var(--tc-label)" }}>A family member, friend, religious leader or your doctor. You don't have to deal with it alone.</span>
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 15 }}>Gambling Therapy</strong>
            <span style={{ fontSize: 14, color: "var(--tc-label)" }}>Free, confidential online support for anyone affected by gambling, worldwide, in several languages: </span>
            <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 700 }}>gamblingtherapy.org</a>
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 15 }}>Regulators</strong>
            <span style={{ fontSize: 14, color: "var(--tc-label)" }}>Betting in Nigeria is overseen by the National Lottery Regulatory Commission and, in Lagos, the Lagos State Lotteries and Gaming Authority.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
