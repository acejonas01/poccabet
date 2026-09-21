import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Hero({ liveCount, eventCount }: { liveCount: number; eventCount: number }) {
  const { isAuthenticated } = useAuth();

  return (
    <section className="hero">
      <div className="hero-text">
        <span className="hero-tag">Nigeria's smartest betting demo</span>
        <h1>
          Bet Smarter. <span>Cash Out Faster.</span>
        </h1>
        <p>
          Thousands of markets across football, basketball and tennis — transparent odds, instant
          virtual payouts, and no hidden bonus terms.
        </p>
        {!isAuthenticated && (
          <div className="hero-actions">
            <Link to="/signup" className="cta-btn large">
              Get ₦10,000 free &amp; start betting
            </Link>
            <Link to="/login" className="ghost-btn">
              I already have an account
            </Link>
          </div>
        )}
        <div className="hero-stats">
          <div>
            <strong>{eventCount}</strong>
            <span>events today</span>
          </div>
          <div>
            <strong className="live-dot-inline">{liveCount}</strong>
            <span>live now</span>
          </div>
          <div>
            <strong>3</strong>
            <span>sports</span>
          </div>
        </div>
      </div>
    </section>
  );
}
