import { useEffect, useState } from "react";
import { api, type Bet } from "../api/client";

const naira = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS: Record<string, string> = { PENDING: "Open", WON: "Won", LOST: "Lost", VOID: "Void", CASHED_OUT: "Cashed out" };

export function MyBets() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMyBets()
      .then((res) => setBets(res.bets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading your bets...</p>;
  if (error) return <p className="error">{error}</p>;
  if (bets.length === 0) return <p>You haven't placed any bets yet.</p>;

  return (
    <div className="my-bets">
      {bets.map((bet) => (
        <div key={bet.id} className={`bet-card status-${bet.status.toLowerCase()}`}>
          <div className="bet-card-header">
            <span className="bet-type">
              {bet.type === "ACCUMULATOR" ? `${bet.selections.length}-fold multiple` : "Single"} · {bet.ticket}
            </span>
            <span className="bet-status">{STATUS[bet.status] ?? bet.status}</span>
          </div>
          {bet.selections.map((sel, i) => (
            <p key={i} className="bet-selection">
              {sel.home} vs {sel.away} — {sel.marketLabel}: <strong>{sel.selection}</strong> @ {sel.odds.toFixed(2)}
              {sel.kickoff && <span style={{ opacity: 0.7 }}> · {when(sel.kickoff)}</span>}
            </p>
          ))}
          <div className="bet-card-footer">
            <span>Stake: {naira(bet.stake)}{bet.type === "ACCUMULATOR" ? ` · odds ${bet.totalOdds.toFixed(2)}` : ""}</span>
            <span>Potential payout: {naira(bet.potentialPayout)}</span>
          </div>
          <div className="bet-card-footer" style={{ opacity: 0.7, fontSize: "0.8em" }}>
            <span>Placed {when(bet.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
