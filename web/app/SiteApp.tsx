"use client";
// The whole Poccabet app (Theme A), shared with the Vite site. It lives in the root layout,
// so it stays mounted while moving between pages: navigation is instant, the slip and tabs stay.
import "../lib/ssr-flag";
import { useEffect, useState } from "react";
import { switchToVisitorClock } from "../../frontend/src/lib/browser";
import { AuthProvider } from "../../frontend/src/context/AuthContext";
import { BetSlipProvider } from "../../frontend/src/context/BetSlipContext";
import { ThemeProvider } from "../../frontend/src/context/ThemeContext";
import { InitialFeedContext, type InitialFeed } from "../../frontend/src/redesign/data";
import { RedesignApp } from "../../frontend/src/redesign/RedesignApp";

export function SiteApp({ feed }: { feed: InitialFeed | null }) {
  // First render uses Nigerian time like the server; then show the visitor's own clock.
  const [, setClock] = useState(0);
  useEffect(() => { switchToVisitorClock(); setClock(1); }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <BetSlipProvider>
          <InitialFeedContext.Provider value={feed}>
            <RedesignApp />
          </InitialFeedContext.Provider>
        </BetSlipProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
