// My Bets for the redesign (Themes A–C): Open / Settled tabs and one card per bet.
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Bet, type BetSelectionInfo } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { dayLabel, hhmm } from "./data";
import { ACCENT, CodeRow, Sheet, SheetTitle, ticketShare } from "./shared";

const naira = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const placedAt = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Open", color: ACCENT },
  WON: { label: "Won", color: "#2AB572" },
  LOST: { label: "Lost", color: "#E5484D" },
  VOID: { label: "Void", color: "var(--tc-label)" },
  CASHED_OUT: { label: "Cashed out", color: "var(--tc-label)" },
};
const RESULT_DOT: Record<string, string> = { WON: "#2AB572", LOST: "#E5484D", VOID: "var(--tc-label)", PENDING: "var(--tc-outline-strong)" };

// "2" in 1X2 reads better as the team: Arsenal. Other markets keep their label (Over, GG, 1X…).
function pickName(s: BetSelectionInfo) {
  if (["1x2", "dnb", "ht"].includes(s.market) || (!s.market && ["1", "X", "2"].includes(s.selection))) {
    if (s.selection === "1") return s.home;
    if (s.selection === "2") return s.away;
    if (s.selection === "X") return "Draw";
  }
  return s.selection;
}

const statusOf = (bet: Bet) => STATUS[bet.status] ?? { label: bet.status, color: "var(--tc-label)" };
const RESULT_TEXT: Record<string, string> = { WON: "Won", LOST: "Lost", VOID: "Void", PENDING: "Open" };
const figure = (label: string, value: string, color = "var(--tc-text)") => (
  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: "var(--tc-label)" }}>{label}</span>
    <span style={{ fontSize: 15, fontWeight: 800, color, whiteSpace: "nowrap" }}>{value}</span>
  </div>
);
const Pill = ({ bet }: { bet: Bet }) => {
  const st = statusOf(bet);
  return <span style={{ flexShrink: 0, padding: "3px 10px", borderRadius: 999, border: `1px solid ${st.color}`, color: st.color, fontSize: 12, fontWeight: 800 }}>{st.label}</span>;
};
const Totals = ({ bet }: { bet: Bet }) => (
  <div style={{ display: "flex", gap: 12, padding: "12px 16px 14px", borderTop: "1px solid var(--tc-line)", background: "var(--tc-panel-2)" }}>
    {figure("STAKE", naira(bet.stake))}
    {figure(bet.type === "ACCUMULATOR" ? "TOTAL ODDS" : "ODDS", bet.totalOdds.toFixed(2))}
    {bet.status === "WON" ? figure("WON", naira(bet.payout ?? bet.potentialPayout), "#2AB572")
      : bet.status === "VOID" ? figure("RETURNED", naira(bet.payout ?? bet.stake))
      : figure("TO WIN", naira(bet.potentialPayout), bet.status === "LOST" ? "var(--tc-label)" : ACCENT)}
  </div>
);

// The full ticket, opened by tapping a bet.
function TicketSheet({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const row = (label: string, value: ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
      <span style={{ color: "var(--tc-label)" }}>{label}</span><span style={{ fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
  return (
    <Sheet label={`Ticket ${bet.ticket}`} onClose={onClose}>
      <SheetTitle title={`Ticket ${bet.ticket}`} onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 20px 14px" }}>
        {row("Status", <Pill bet={bet} />)}
        {row("Bet type", bet.type === "ACCUMULATOR" ? `Multiple · ${bet.selections.length} selections` : "Single")}
        {row("Placed", placedAt(bet.createdAt))}
        {bet.settledAt && row("Settled", placedAt(bet.settledAt))}
      </div>
      {bet.selections.map((s, i) => {
        const kickoff = s.kickoff ? new Date(s.kickoff) : null;
        return (
          <div key={i} style={{ display: "flex", gap: 10, padding: "12px 20px", borderTop: "1px solid var(--tc-line)" }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 6, borderRadius: 4, background: RESULT_DOT[s.result] ?? RESULT_DOT.PENDING }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{pickName(s)} <span style={{ fontWeight: 600, color: "var(--tc-soft)" }}>· {s.marketLabel}</span></span>
              <span style={{ fontSize: 13 }}>{s.home} vs {s.away}</span>
              <span style={{ fontSize: 12, color: "var(--tc-label)" }}>
                {[s.league, kickoff && kickoff.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>{s.odds.toFixed(2)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: RESULT_DOT[s.result] === RESULT_DOT.PENDING ? "var(--tc-label)" : RESULT_DOT[s.result] }}>{RESULT_TEXT[s.result] ?? s.result}</span>
            </div>
          </div>
        );
      })}
      <Totals bet={bet} />
      <div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: "var(--tc-label)" }}>TICKET ID</span>
        <CodeRow code={bet.ticket} share={ticketShare(bet.ticket, bet.selections.length, bet.totalOdds)} />
      </div>
    </Sheet>
  );
}

function BetCard({ bet, onOpen }: { bet: Bet; onOpen: () => void }) {
  const multi = bet.type === "ACCUMULATOR";
  // The whole card is one button: tapping anywhere (the "Open" pill too) opens the ticket.
  return (
    <button onClick={onOpen} aria-label={`Ticket ${bet.ticket}, ${statusOf(bet).label}. Show details`} style={{
      width: "100%", padding: 0, textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer",
      background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 14, overflow: "hidden", display: "block",
    }}>
      {/* Header: type + status, then ticket and when it was placed */}
      <div style={{ padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{multi ? `Multiple · ${bet.selections.length} selections` : "Single"}</span>
          <Pill bet={bet} />
        </div>
        <span style={{ fontSize: 12, color: "var(--tc-label)" }}>Ticket <strong style={{ color: "var(--tc-soft)", letterSpacing: 0.5 }}>{bet.ticket}</strong> · {placedAt(bet.createdAt)}</span>
      </div>

      {/* Selections */}
      {bet.selections.map((s, i) => {
        const kickoff = s.kickoff ? new Date(s.kickoff).getTime() : null;
        return (
          <div key={i} style={{ display: "flex", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--tc-line)" }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 6, borderRadius: 4, background: RESULT_DOT[s.result] ?? RESULT_DOT.PENDING }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{pickName(s)}</span>
              <span style={{ fontSize: 12, color: "var(--tc-soft)" }}>{s.marketLabel}</span>
              <span style={{ fontSize: 12, color: "var(--tc-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.home} vs {s.away}{kickoff ? ` · ${dayLabel(kickoff)} ${hhmm(kickoff)}` : ""}
              </span>
            </div>
            <span style={{ flexShrink: 0, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>{s.odds.toFixed(2)}</span>
          </div>
        );
      })}

      {/* Stake · odds · to win */}
      <Totals bet={bet} />
    </button>
  );
}

export function RedesignMyBets() {
  const { isAuthenticated, refreshBalance } = useAuth();
  const navigate = useNavigate();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "settled">("open");
  const [openBet, setOpenBet] = useState<Bet | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    // Loading bets also settles any finished ones, so refresh the balance for winnings.
    api.getMyBets().then((r) => { setBets(r.bets); refreshBalance().catch(() => {}); }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const open = bets.filter((b) => b.status === "PENDING");
  const settled = bets.filter((b) => b.status !== "PENDING");
  const shown = tab === "open" ? open : settled;
  const note = (text: string) => <p style={{ margin: 0, padding: "40px 0", textAlign: "center", fontSize: 14, color: "var(--tc-label)" }}>{text}</p>;
  const tabBtn = (id: "open" | "settled", label: string, n: number) => (
    <button role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{
      height: 44, padding: 0, border: "none", background: "transparent", borderBottom: `2px solid ${tab === id ? ACCENT : "transparent"}`,
      color: tab === id ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 15, fontWeight: tab === id ? 800 : 700,
    }}>{label}{n ? ` (${n})` : ""}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>My Bets</h1>
      {!isAuthenticated ? (
        <div style={{ padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--tc-label)" }}>Log in to see your bets.</p>
          <button onClick={() => navigate("/login")} style={{ height: 44, padding: "0 24px", borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontSize: 15, fontWeight: 800 }}>Login</button>
        </div>
      ) : (
        <>
          <div role="tablist" style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--tc-line)" }}>
            {tabBtn("open", "Open", open.length)}
            {tabBtn("settled", "Settled", settled.length)}
          </div>
          {loading ? note("Loading your bets…")
            : error ? note(error)
            : shown.length === 0 ? note(tab === "open" ? "No open bets. Tap any odds to start a slip." : "No settled bets yet.")
            : shown.map((b) => <BetCard key={b.id} bet={b} onOpen={() => setOpenBet(b)} />)}
        </>
      )}
      {openBet && <TicketSheet bet={openBet} onClose={() => setOpenBet(null)} />}
    </div>
  );
}
