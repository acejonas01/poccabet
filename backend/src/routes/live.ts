import { Router } from "express";
import { getUpcomingMerged } from "../providers/aggregate";
import { getApiFootballUsage, getLiveFixtures, getUpcomingAndResults } from "../providers/apifootball";
import { simLive, simResults, simUpcoming, simWinners } from "../providers/simulation";
import { SIMULATE } from "../lib/feedMode";
import { recentWins } from "../betting/winners";
import { requireAdminKey } from "../middleware/admin";

const router = Router();


// GET /api/live — in-play football fixtures (cached server-side)
router.get("/", async (_req, res) => {
  if (SIMULATE) {
    const fixtures = simLive();
    return res.json({ count: fixtures.length, fetchedAt: new Date(), stale: false, simulated: true, fixtures });
  }
  try {
    const { data: fixtures, fetchedAt, stale } = await getLiveFixtures();
    res.json({ count: fixtures.length, fetchedAt: new Date(fetchedAt), stale, fixtures });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/upcoming — not-yet-played games from every provider, merged (each provider cached)
router.get("/upcoming", async (_req, res) => {
  if (SIMULATE) {
    const events = simUpcoming();
    return res.json({ count: events.length, sources: { simulation: events.length }, simulated: true, events });
  }
  try {
    const { events, sources } = await getUpcomingMerged();
    res.json({ count: events.length, sources, events });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/results — today's finished games (free: shares the upcoming refresh)
router.get("/results", async (_req, res) => {
  if (SIMULATE) {
    const results = simResults();
    return res.json({ count: results.length, fetchedAt: new Date(), stale: false, simulated: true, results });
  }
  try {
    const { data, fetchedAt, stale } = await getUpcomingAndResults();
    res.json({ count: data.finished.length, fetchedAt: new Date(fetchedAt), stale, results: data.finished });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/winners — recent wins. Demo mode: simulated. Live mode: real settled winning
// bets only — the section stays hidden until there are some, never padded with fakes.
router.get("/winners", async (_req, res) => {
  if (SIMULATE) return res.json({ simulated: true, winners: simWinners() });
  try {
    res.json({ simulated: false, winners: await recentWins() });
  } catch {
    res.json({ simulated: false, winners: [] });
  }
});

// GET /api/live/usage — how many API-Football calls we've spent today (admin only)
router.get("/usage", requireAdminKey, (_req, res) => {
  res.json({ mode: SIMULATE ? "simulation" : "live", ...getApiFootballUsage() });
});

export default router;
