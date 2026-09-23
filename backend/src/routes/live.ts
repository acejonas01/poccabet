import { Router } from "express";
import { getApiFootballUsage, getLiveFixtures, getUpcomingAndResults } from "../providers/apifootball";

const router = Router();

// GET /api/live — in-play football fixtures (cached server-side)
router.get("/", async (_req, res) => {
  try {
    const { data: fixtures, fetchedAt, stale } = await getLiveFixtures();
    res.json({ count: fixtures.length, fetchedAt: new Date(fetchedAt), stale, fixtures });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/upcoming — not-yet-played football games with pre-match odds (cached 3h)
router.get("/upcoming", async (_req, res) => {
  try {
    const { data, fetchedAt, stale } = await getUpcomingAndResults();
    res.json({ count: data.upcoming.length, fetchedAt: new Date(fetchedAt), stale, events: data.upcoming });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/results — today's finished games (free: shares the upcoming refresh)
router.get("/results", async (_req, res) => {
  try {
    const { data, fetchedAt, stale } = await getUpcomingAndResults();
    res.json({ count: data.finished.length, fetchedAt: new Date(fetchedAt), stale, results: data.finished });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/usage — how many API-Football calls we've spent today
router.get("/usage", (_req, res) => {
  res.json(getApiFootballUsage());
});

export default router;
