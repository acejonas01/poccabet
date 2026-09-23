import { Router } from "express";
import { getApiFootballUsage, getLiveFixtures } from "../providers/apifootball";

const router = Router();

// GET /api/live — in-play football fixtures (cached server-side)
router.get("/", async (_req, res) => {
  try {
    const { fixtures, fetchedAt, stale } = await getLiveFixtures();
    res.json({ count: fixtures.length, fetchedAt: new Date(fetchedAt), stale, fixtures });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/live/usage — how many API-Football calls we've spent today
router.get("/usage", (_req, res) => {
  res.json(getApiFootballUsage());
});

export default router;
