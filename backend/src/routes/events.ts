import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/events?status=SCHEDULED&sport=football
router.get("/", async (req, res) => {
  const { status, sport } = req.query;

  const events = await prisma.event.findMany({
    where: {
      ...(status ? { status: String(status) } : {}),
      ...(sport ? { sport: { slug: String(sport) } } : {}),
    },
    include: {
      sport: true,
      markets: { include: { outcomes: true } },
    },
    orderBy: { startTime: "asc" },
  });

  res.json({ events });
});

router.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { sport: true, markets: { include: { outcomes: true } } },
  });

  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json({ event });
});

export default router;
