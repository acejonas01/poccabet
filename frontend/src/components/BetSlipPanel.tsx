import { useEffect, useState } from "react";
import { useBetSlip } from "../context/BetSlipContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export function BetSlipPanel() {
  const { selections, removeSelection, clear, combinedOdds } = useBetSlip();
  const { isAuthenticated, balance, refreshBalance } = useAuth();
  const [stake, setStake] = useState<number>(100);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bookingCode, setBookingCode] = useState("");

  const potentialPayout = stake * combinedOdds;

  useEffect(() => {
    if (selections.length === 0) setMobileOpen(false);
  }, [selections.length]);

  async function handlePlaceBet() {
    setMessage(null);
    if (!isAuthenticated) {
      setMessage("Log in to place a bet.");
      return;
    }
    if (selections.length === 0) return;

    setPlacing(true);
    try {
      await api.placeBet({ stake, outcomeIds: selections.map((s) => s.outcomeId) });
      setMessage("Bet placed!");
      clear();
      await refreshBalance();
    } catch (err: any) {
      setMessage(err.message ?? "Failed to place bet");
    } finally {
      setPlacing(false);
    }
  }

  const slipContent = (
    <>
      <div className="slip-header">
        <h3>Betslip ({selections.length})</h3>
        <div className="slip-header-actions">
          <button onClick={clear} className="link-btn">Clear</button>
          <button onClick={() => setMobileOpen(false)} className="link-btn mobile-close-btn">Close</button>
        </div>
      </div>

      {selections.map((s) => (
        <div key={s.outcomeId} className="slip-item">
          <div>
            <p className="slip-event">{s.eventLabel}</p>
            <p className="slip-market">
              {s.marketName}: <strong>{s.label}</strong>
            </p>
          </div>
          <div className="slip-item-right">
            <span className="slip-odds">{s.odds.toFixed(2)}</span>
            <button onClick={() => removeSelection(s.outcomeId)} className="remove-btn">
              {"×"}
            </button>
          </div>
        </div>
      ))}

      <div className="stake-row">
        <label htmlFor="stake">Stake ({"₦"})</label>
        <input
          id="stake"
          type="number"
          min={10}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
        />
      </div>

      <div className="summary-row">
        <span>Combined odds</span>
        <span>{combinedOdds.toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span>Potential payout</span>
        <span>{"₦"}{potentialPayout.toFixed(2)}</span>
      </div>

      {isAuthenticated && (
        <p className="balance-note">Wallet: {"₦"}{balance.toFixed(2)}</p>
      )}

      <button className="place-bet-btn" onClick={handlePlaceBet} disabled={placing}>
        {placing ? "Placing..." : "Place Bet"}
      </button>

      {message && <p className="slip-message">{message}</p>}
    </>
  );

  return (
    <aside className="right-sidebar">
      <div className="right-sidebar-inner">
        <div className="quick-links">
          <a href="#" className="quick-link">
            <span>{"📅"}</span> Explore Todays Matchs
          </a>
          <a href="#" className="quick-link">
            <span>{"🎮"}</span> Bet on Victuals Now
          </a>
          <a href="#" className="quick-link">
            <span>{"🎁"}</span> Promotions & Bonuses
          </a>
        </div>

        <div className="betslip-box">
          <h3 className="betslip-title">Betslip</h3>
          {selections.length === 0 ? (
            <div className="betslip-empty">
              <p>Click on the odds or enter a code to be loaded.</p>
              <div className="booking-row">
                <input
                  type="text"
                  placeholder="Booking Code"
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value)}
                />
                <button className="btn-load">Load</button>
              </div>
            </div>
          ) : (
            slipContent
          )}
        </div>

        <div className="sidebar-promo-card">
          <p>Poccabet</p>
          <span>Your Winning Partner</span>
        </div>

        <div className="contact-section">
          <h4>Contact Us</h4>
          <div className="contact-icons">
            <a href="#" title="Email">{"📧"}</a>
            <a href="#" title="Support">{"🎧"}</a>
            <a href="#" title="Twitter">{"🐦"}</a>
          </div>
          <div className="footer-links">
            <a href="#">T&C</a>
            <a href="#">Promotions</a>
            <a href="#">FAQ</a>
            <a href="#">Affiliate</a>
            <a href="#">Contact Us</a>
          </div>
          <button className="chat-now-btn">CHAT NOW</button>
        </div>
      </div>

      {selections.length > 0 && (
        <button className="mobile-slip-trigger" onClick={() => setMobileOpen(true)}>
          Betslip {"·"} {selections.length} selection{selections.length > 1 ? "s" : ""}
        </button>
      )}

      {mobileOpen && (
        <div className="mobile-slip-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            {slipContent}
          </div>
        </div>
      )}
    </aside>
  );
}
