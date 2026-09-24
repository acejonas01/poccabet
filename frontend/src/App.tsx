import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { BetSlipProvider } from "./context/BetSlipContext";
import { FilterProvider } from "./context/FilterContext";
import { Header } from "./components/Header";
import { LeftSidebar } from "./components/LeftSidebar";
import { BetSlipPanel } from "./components/BetSlipPanel";
import { OddsBoard } from "./pages/OddsBoard";
import { Auth } from "./pages/Auth";
import { MyBets } from "./pages/MyBets";
import { useTheme } from "./context/ThemeContext";
import { ThemeCApp } from "./themeC/ThemeCApp";
import "./index.css";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme } = useTheme();

  return (
    <AuthProvider>
      <BetSlipProvider>
        <FilterProvider>
          {/* Theme C is a full redesign with its own layout */}
          {theme === "c" ? <ThemeCApp /> : <>
          <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />
          <main className="app-layout">
            <LeftSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="app-content">
              <Routes>
                <Route path="/" element={<OddsBoard />} />
                <Route path="/login" element={<Auth mode="login" />} />
                <Route path="/signup" element={<Auth mode="signup" />} />
                <Route path="/my-bets" element={<MyBets />} />
              </Routes>
            </div>
            <BetSlipPanel />
          </main>
          <footer className="app-footer">
            <div className="footer-main">
              <img src="/logo.png" alt="Poccabet" className="footer-logo" />

              <div className="footer-center">
                <nav className="footer-nav">
                  <a href="#">SPORTS</a>
                  <a href="#">LIVE</a>
                  <a href="#">BECOME AN AGENT</a>
                  <a href="#">ABOUT US</a>
                  <a href="#">CONTACT US</a>
                  <a href="#">HELP</a>
                  <a href="#">AFFILIATES</a>
                  <a href="#">T&CS</a>
                  <a href="#">PRIVACY POLICY</a>
                </nav>

                <div className="footer-socials">
                  <a href="#" aria-label="Facebook">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
                    </svg>
                  </a>
                  <a href="#" aria-label="X">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.22-6.82-5.96 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64Z" />
                    </svg>
                  </a>
                  <a href="#" aria-label="Instagram">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.89 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm4.33-7.06a.97.97 0 1 0 0-1.95.97.97 0 0 0 0 1.95Z" />
                    </svg>
                  </a>
                  <a href="#" aria-label="YouTube">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.5 6.5a3 3 0 0 0-2.12-2.13C19.5 3.86 12 3.86 12 3.86s-7.5 0-9.38.51A3 3 0 0 0 .5 6.5 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.5 3 3 0 0 0 2.12 2.13c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3 3 0 0 0 2.12-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.5ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
                    </svg>
                  </a>
                </div>
              </div>

              <div className="footer-responsible">
                <span>Play Responsibly</span>
                <span className="age-badge">18+</span>
              </div>
            </div>

            <div className="footer-bottom">
              <p>
                {"©"} {new Date().getFullYear()} Poccabet Technologies Ltd. is regulated by the
                National Lottery Regulatory Commission.
              </p>
            </div>
          </footer>
          </>}
        </FilterProvider>
      </BetSlipProvider>
    </AuthProvider>
  );
}

export default App;
