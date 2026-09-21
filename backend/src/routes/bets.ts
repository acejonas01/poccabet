import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

const placeBetSchema = z.object({
  stake: z.number().positive(),
  outcomeIds: z.array(z.string()).min(1),
});

// Place a single bet or accumulator (multiple outcomeIds = accumulator, odds multiply).
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = placeBetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { stake, outcomeIds } = parsed.data;

  try {
    const bet = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: req.userId! } });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");
      if (wallet.balance < stake) throw new Error("INSUFFICIENT_BALANCE");

      const outcomes = await tx.outcome.findMany({ where: { id: { in: outcomeIds } } });
      if (outcomes.length !== outcomeIds.length) throw new Error("OUTCOME_NOT_FOUND");

      const combinedOdds = outcomes.reduce((acc, o) => acc * o.odds, 1);
      const potentialPayout = Math.round(stake * combinedOdds * 100) / 100;

      const newBalance = wallet.balance - stake;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: "BET_STAKE",
          amount: -stake,
          status: "COMPLETED",
        },
      });

      return tx.bet.create({
        data: {
          userId: req.userId!,
          stake,
          potentialPayout,
          type: outcomeIds.length > 1 ? "ACCUMULATOR" : "SINGLE",
          status: "PENDING",
          selections: {
            create: outcomes.map((o) => ({
              outcomeId: o.id,
              oddsAtPlacement: o.odds,
              result: "PENDING",
            })),
          },
        },
        include: { selections: true },
      });
    });

    res.status(201).json({ bet });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Insufficient balance" });
    }
    if (err.message === "OUTCOME_NOT_FOUND") {
      return res.status(400).json({ error: "One or more selections not found" });
    }
    if (err.message === "WALLET_NOT_FOUND") {
      return res.status(404).json({ error: "Wallet not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to place bet" });
  }
});

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const bets = await prisma.bet.findMany({
    where: { userId: req.userId! },
    include: { selections: { include: { outcome: { include: { market: { include: { event: true } } } } } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ bets });
});

export default router;
