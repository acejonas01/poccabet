import { useEffect, useState } from "react";
import { api } from "../api/client";

export function MyBets() {
  const [bets, setBets] = useState<any[]>([]);
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
            <span className="bet-type">{bet.type}</span>
            <span className="bet-status">{bet.status}</span>
          </div>
          {bet.selections.map((sel: any) => (
            <p key={sel.id} className="bet-selection">
              {sel.outcome.market.event.homeTeam} vs {sel.outcome.market.event.awayTeam} —{" "}
              {sel.outcome.market.name}: <strong>{sel.outcome.label}</strong> @ {sel.oddsAtPlacement.toFixed(2)}
            </p>
          ))}
          <div className="bet-card-footer">
            <span>Stake: ₦{bet.stake.toFixed(2)}</span>
            <span>Potential payout: ₦{bet.potentialPayout.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
