import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { simTopPick } from "../providers/simulation";

// "Pick of the day" = the selection bettors add to their slips most today.
// A pick is anonymous: one per device + match + UTC day; changing it moves the vote.
const router = Router();

const today = () => new Date().toISOString().slice(0, 10);

const pickSchema = z.object({
  deviceId: z.string().min(8).max(64),
  matchId: z.string().min(1).max(64),
  market: z.string().min(1).max(16),
  selection: z.string().min(1).max(24).nullable(), // null = removed from the slip
  home: z.string().max(80),
  away: z.string().max(80),
  league: z.string().max(80),
  country: z.string().max(40).default(""),
  homeLogo: z.string().max(200).default(""),
  awayLogo: z.string().max(200).default(""),
  kickoff: z.coerce.date(),
});

// POST /api/picks — record (or clear) this device's pick for a match
router.post("/", async (req, res) => {
  const parsed = pickSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid pick" });
  // Simulated games aren't real bets — don't store picks for them.
  if (SIMULATE) return res.json({ ok: true, simulated: true });
  const { deviceId, matchId, selection, ...rest } = parsed.data;
  const day = today();
  const key = { day_deviceId_matchId: { day, deviceId, matchId } };

  try {
    if (selection === null) {
      await prisma.pick.deleteMany({ where: { day, deviceId, matchId } });
    } else {
      await prisma.pick.upsert({
        where: key,
        create: { day, deviceId, matchId, selection, ...rest },
        update: { selection, market: rest.market },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to record pick", err);
    res.status(500).json({ error: "Couldn't record the pick" });
  }
});

// GET /api/picks/top — today's most-picked selection on a match that hasn't kicked off
router.get("/top", async (_req, res) => {
  if (SIMULATE) return res.json({ top: simTopPick(), totalToday: null, simulated: true });
  try {
    const day = today();
    const now = new Date();
    const groups = await prisma.pick.groupBy({
      by: ["matchId", "market", "selection"],
      where: { day, kickoff: { gt: now } },
      _count: { _all: true },
      orderBy: { _count: { matchId: "desc" } },
      take: 1,
    });
    const totalToday = await prisma.pick.count({ where: { day } });
    if (!groups.length) return res.json({ top: null, totalToday });

    const g = groups[0];
    const match = await prisma.pick.findFirst({ where: { day, matchId: g.matchId }, orderBy: { updatedAt: "desc" } });
    const matchPicks = await prisma.pick.count({ where: { day, matchId: g.matchId } });
    res.json({
      top: {
        matchId: g.matchId,
        market: g.market,
        selection: g.selection,
        count: g._count._all,
        matchPicks,
        home: match?.home,
        away: match?.away,
        league: match?.league,
        country: match?.country,
        homeLogo: match?.homeLogo,
        awayLogo: match?.awayLogo,
        kickoff: match?.kickoff,
      },
      totalToday,
    });
  } catch (err) {
    console.error("Failed to load top pick", err);
    res.status(500).json({ error: "Couldn't load the top pick" });
  }
});

export default router;
