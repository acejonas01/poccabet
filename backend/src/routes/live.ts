import { Router } from "express";
import { getUpcomingMerged } from "../providers/aggregate";
import { getApiFootballUsage, getLiveFixtures, getUpcomingAndResults } from "../providers/apifootball";
import { simLive, simMatchInfo, simResults, simUpcoming, simWinners } from "../providers/simulation";
import { SIMULATE } from "../lib/feedMode";
import { recentWins } from "../betting/winners";
import { requireAdminKey } from "../middleware/admin";
import { lockMarkets, suspendedIds } from "../betting/suspensions";

const router = Router();


// GET /api/live — in-play football fixtures (cached server-side)
router.get("/", async (_req, res) => {
  const ids = await suspendedIds();
  const lock = <T extends { externalId: string; markets: any[] }>(list: T[]) => (ids.size ? list.map((f) => (ids.has(f.externalId) ? lockMarkets(f) : f)) : list);
  if (SIMULATE) {
    const fixtures = lock(simLive());
    return res.json({ count: fixtures.length, fetchedAt: new Date(), stale: false, simulated: true, fixtures });
  }
  try {
    const { data, fetchedAt, stale } = await getLiveFixtures();
    const fixtures = lock(data);
    res.json({ count: fixtures.length, fetchedAt: new Date(fetchedAt), stale, fixtures });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/info/:matchId — head-to-head, form, league table and line-ups for the match view.
// Only the simulation has these for now; with a real provider it says they're not available.
router.get("/info/:matchId", (req, res) => {
  if (!SIMULATE) return res.json({ available: false });
  const info = simMatchInfo(String(req.params.matchId).slice(0, 64));
  if (!info) return res.status(404).json({ error: "Unknown match", code: "BAD_MATCH" });
  res.json({ available: true, ...info });
});

// GET /api/live/upcoming — not-yet-played games from every provider, merged (each provider cached)
router.get("/upcoming", async (_req, res) => {
  const ids = await suspendedIds();
  const lock = <T extends { externalId: string; markets: any[] }>(list: T[]) => (ids.size ? list.map((e) => (ids.has(e.externalId) ? lockMarkets(e) : e)) : list);
  if (SIMULATE) {
    const events = lock(simUpcoming());
    return res.json({ count: events.length, sources: { simulation: events.length }, simulated: true, events });
  }
  try {
    const merged = await getUpcomingMerged();
    const events = lock(merged.events);
    res.json({ count: events.length, sources: merged.sources, events });
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
