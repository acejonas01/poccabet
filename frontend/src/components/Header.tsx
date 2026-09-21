import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Header({ onToggleSidebar: _onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { isAuthenticated, user, balance, logout } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "a");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <>
      <header className="header-primary">
        {/* <button className="menu-toggle" aria-label="Menu" onClick={onToggleSidebar}>
          <span />
          <span />
          <span />
        </button> */}
        <Link to="/" className="brand">
          <img src="/logo.png" alt="Poccabet" className="brand-logo" />
        </Link>
        <nav className="header-nav-primary">
          <a href="#" className="nav-live active">
            <img src="/icons/live.png" alt="" className="nav-tv-icon" />
            Live now
          </a>
          <a href="#">Recommended</a>
          <a href="#">Today</a>
          <a href="#">Upcoming Live</a>
          <a href="#">Top Tournaments</a>
          <a href="#">Streaming Now</a>
          <Link to="/my-bets" className={location.pathname === "/my-bets" ? "active" : ""}>
            My Matches
          </Link>
        </nav>
        <div className="header-auth">
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === "a" ? "b" : "a"))}
            title="Switch colour theme"
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {"◐"}
            </span>
            <span className="theme-toggle-word">Theme </span>
            {theme.toUpperCase()}
          </button>
          {isAuthenticated ? (
            <>
              <span className="balance-pill">{"₦"}{balance.toFixed(2)}</span>
              <span className="user-name">{user?.displayName}</span>
              <button onClick={logout} className="btn-logout">Log out</button>
            </>
          ) : (
            <>
              <Link to="/signup" className="btn-register">
                <span className="label-wide">Register</span>
                <span className="label-compact">Join</span>
              </Link>
              <Link to="/login" className="btn-login">Login</Link>
            </>
          )}
        </div>
      </header>
      <div className="header-secondary">
        <nav className="header-nav-secondary">
          <Link to="/" className={location.pathname === "/" ? "active" : ""}>Home</Link>
          <a href="#">Today</a>
          <a href="#">Soccer</a>
          <a href="#">Statistics</a>
          <a href="#">Results</a>
          <a href="#">Livescore</a>
          <a href="#">Tutorials</a>
          <a href="#">Mobile</a>
          <a href="#">Promotions</a>
        </nav>
      </div>
    </>
  );
}
