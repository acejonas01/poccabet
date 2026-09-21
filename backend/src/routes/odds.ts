import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getOddsProvider } from "../providers";

const router = Router();

router.get("/sports", async (_req, res) => {
  try {
    const provider = getOddsProvider();
    const sports = await provider.getSupportedSports();
    res.json({ provider: provider.name, sports });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/live", async (req, res) => {
  try {
    const provider = getOddsProvider();
    const events = await provider.fetchEvents(req.query.sport as string);
    res.json({ provider: provider.name, count: events.length, events });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/sync", async (req, res) => {
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
