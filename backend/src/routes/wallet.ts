import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  res.json({ balance: wallet.balance });
});

router.get("/transactions", requireAuth, async (req: AuthedRequest, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  const transactions = await prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({ transactions });
});

export default router;
