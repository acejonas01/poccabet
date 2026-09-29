// Privacy policy (/privacy): what Poccabet keeps about players, why, who else handles it, and
// players' rights. Plain language, written from what the code actually does; keep it in step when
// that changes (new data, new outside service). Needs a lawyer's review before the licence.
import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "./icons";
import { canGoBack } from "./shared";
import { SUPPORT_EMAIL } from "./shortcuts";

const UPDATED = "29 September 2026";

export function PrivacyPolicy({ desktop = false }: { desktop?: boolean }) {
  const navigate = useNavigate();
  // Phones: full-width sections on the dark page (like the account page); desktop: cards.
  const box: CSSProperties = desktop
    ? { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 16, padding: 20 }
    : { background: "var(--tc-card)", margin: "0 -16px", padding: "18px 16px" };
  const h2: CSSProperties = { margin: "0 0 12px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, lineHeight: 1.1 };
  const p: CSSProperties = { margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "var(--tc-soft)", maxWidth: "66ch" };
  const strong = (t: ReactNode) => <strong style={{ color: "var(--tc-text)" }}>{t}</strong>;
  const list = (items: [string, ReactNode][]) => (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map(([t, d]) => (
        <li key={t}>
          <strong style={{ display: "block", fontSize: 15 }}>{t}</strong>
          <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--tc-label)" }}>{d}</span>
        </li>
      ))}
    </ul>
  );
  const section = (id: string, title: string, body: ReactNode) => (
    <section aria-labelledby={id} style={box}>
      <h2 id={id} style={h2}>{title}</h2>
      {body}
    </section>
  );

  return (
    <div className={desktop ? undefined : "tc-account-page"} style={{ display: "flex", flexDirection: "column", gap: desktop ? 16 : 8, margin: desktop ? 0 : "-16px 0 0", maxWidth: desktop ? 760 : undefined }}>
      <header style={{ ...box, display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="button" onClick={() => (canGoBack() ? navigate(-1) : navigate("/"))} aria-label="Back" style={{ alignSelf: "flex-start", width: 36, height: 36, margin: "-6px 0 -6px -8px", border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={18} />
        </button>
        <h1 style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontStyle: "italic", fontSize: 34, lineHeight: 1 }}>Privacy policy</h1>
        <p style={p}>This explains what {strong("Poccabet Technologies Ltd.")} keeps about you, why, who else handles it, and how to see, correct or delete it. We never sell your personal data.</p>
        <p style={{ ...p, fontSize: 13, color: "var(--tc-label)" }}>Last updated {UPDATED}</p>
      </header>

      {section("pp-collect", "What we keep", list([
        ["Your account", "Your name, phone number or email, date of birth (to confirm you're 18 or older), and your password, stored scrambled so nobody can read it."],
        ["Your money", "Deposits, withdrawals, your balance and its history, and the bank account you choose for payouts."],
        ["Your bets", "The bets you place and their results. Booking codes you create hold only the picks, not who made them."],
        ["Match chat", "Messages you post. Other players only see your name partly hidden."],
        ["Security records", "When you log in, from which device and browser, and your internet (IP) address, to spot anyone else using your account."],
        ["How you found us", "The link or promotion code that brought you to Poccabet, if any."],
      ]))}

      {section("pp-use", "Why we use it", list([
        ["To run your account", "Logging you in, keeping your balance right, settling your bets and paying your winnings."],
        ["To keep betting safe and legal", "Checking you're over 18, stopping fraud and misuse, and keeping the records the law requires."],
        ["To help you", "Answering customer care questions about your account, bets or payments."],
        ["To improve Poccabet", "Seeing which pages and features are used and where people get stuck (see Analytics below)."],
      ]))}

      {section("pp-share", "Who else handles it", <>
        <p style={{ ...p, marginBottom: 14 }}>A few trusted companies run parts of Poccabet for us. They may only use your data to do that job.</p>
        {list([
          ["Paystack (payments)", "Handles deposits and payouts. Card details are typed into Paystack's own secure page and never reach Poccabet."],
          ["Neon, Render and Vercel (hosting)", "Store our database (in Frankfurt, Germany) and run our servers and website."],
          ["PostHog (analytics, EU)", "Shows us how the site is used: pages viewed, taps and clicks, and recordings of visits to find problems. Everything you type into forms is hidden in those recordings, and PostHog knows you only by an internal number, never by your name, phone number or email."],
          ["Sentry (error alerts)", "Tells us when something on the site breaks. It receives technical details only, no personal information."],
          ["Authorities", "Regulators, courts or the police, only when the law requires it."],
        ])}
      </>)}

      {section("pp-storage", "Cookies and browser storage", <p style={p}>We save a few things in your browser so the site works: keeping you logged in, your bet slip and your settings (like hiding your balance). PostHog also saves a random number there to recognise repeat visits. You can clear these in your browser settings at any time; you'll just be logged out.</p>)}

      {section("pp-keep", "How long we keep it", <p style={p}>While your account is open, we keep what's listed above. If you close your account, we erase your personal details from it and you can no longer log in. We keep your identity and your betting and money records for as long as the law requires (for example, for anti-money-laundering checks), then delete them.</p>)}

      {section("pp-rights", "Your rights", <>
        <p style={{ ...p, marginBottom: 12 }}>Under the Nigeria Data Protection Act 2023 you can ask us to:</p>
        {list([
          ["See your data", "Get a copy of what we keep about you."],
          ["Correct it", "Fix anything that's wrong. You can change most details yourself in My account."],
          ["Delete it", "Close your account in My account → Personal details, or ask customer care."],
          ["Object", "Ask us to stop using your data for anything other than running your account."],
        ])}
        <p style={{ ...p, marginTop: 14 }}>Email {strong(<a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "inherit" }}>{SUPPORT_EMAIL}</a>)} and we'll reply within 30 days. If you're not happy with our answer, you can complain to the Nigeria Data Protection Commission.</p>
      </>)}

      {section("pp-age", "Adults only", <p style={p}>Poccabet is for people aged 18 and over. We don't knowingly keep data about anyone younger; if we find an account belongs to someone under 18, we close it.</p>)}

      {section("pp-changes", "Changes to this policy", <p style={p}>If we change how we use your data, we'll update this page and the date at the top. For big changes, we'll tell you on the site before they take effect.</p>)}
    </div>
  );
}
