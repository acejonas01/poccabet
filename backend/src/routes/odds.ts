import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getOddsProvider } from "../providers";
import { requireAdminKey } from "../middleware/admin";

const router = Router();

// The provider's answers are reused for a while: every visitor asking can't spend API quota.
const cache = new Map<string, { at: number; data: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

router.get("/sports", async (_req, res) => {
  try {
    const provider = getOddsProvider();
    const sports = await cached("sports", 60 * 60_000, () => provider.getSupportedSports());
    res.json({ provider: provider.name, sports });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/live", async (req, res) => {
  try {
    const provider = getOddsProvider();
    const sport = String(req.query.sport ?? "").slice(0, 60);
    const events = await cached(`live:${sport}`, 60_000, () => provider.fetchEvents(sport || undefined));
    res.json({ provider: provider.name, count: events.length, events });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/odds/sync — pull odds into the database (admin only: it spends quota and writes data).
router.post("/sync", requireAdminKey, async (req, res) => {
  try {
    const provider = getOddsProvider();
    const sportKey = (req.query.sport as string) || undefined;
    const events = await provider.fetchEvents(sportKey);

    let synced = 0;
    for (const evt of events) {
      let sport = await prisma.sport.findUnique({ where: { slug: evt.sport } });
      if (!sport) {
        sport = await prisma.sport.create({
          data: { name: evt.league, slug: evt.sport },
        });
      }

      const existing = await prisma.event.findFirst({
        where: { homeTeam: evt.homeTeam, awayTeam: evt.awayTeam, startTime: evt.startTime },
        include: { markets: { include: { outcomes: true } } },
      });

      if (existing) {
        for (const mkt of existing.markets) {
          await prisma.outcome.deleteMany({ where: { marketId: mkt.id } });
        }
        await prisma.market.deleteMany({ where: { eventId: existing.id } });

        for (const m of evt.markets) {
          await prisma.market.create({
            data: {
              eventId: existing.id,
              type: m.type,
              name: m.name,
              outcomes: { create: m.outcomes.map((o) => ({ label: o.label, odds: o.odds })) },
            },
          });
        }
        synced++;
      } else {
        await prisma.event.create({
          data: {
            sportId: sport.id,
            league: evt.league,
            homeTeam: evt.homeTeam,
            awayTeam: evt.awayTeam,
            startTime: evt.startTime,
            status: "SCHEDULED",
            markets: {
              create: evt.markets.map((m) => ({
                type: m.type,
                name: m.name,
                outcomes: { create: m.outcomes.map((o) => ({ label: o.label, odds: o.odds })) },
              })),
            },
          },
        });
        synced++;
      }
    }

    res.json({ provider: provider.name, synced, total: events.length });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
