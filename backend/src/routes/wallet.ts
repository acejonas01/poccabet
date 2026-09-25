import { Router } from "express";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { toNaira } from "../betting/money";

const router = Router();

// GET /api/wallet — balance in naira. `demo` = play money (simulation mode).
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  res.json({ balance: toNaira(wallet.balance), demo: SIMULATE });
});

router.get("/transactions", requireAuth, async (req: AuthedRequest, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });

  const transactions = await prisma.transaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({
    transactions: transactions.map((t) => ({
      ...t,
      amount: toNaira(t.amount),
      balanceAfter: t.balanceAfter === null ? null : toNaira(t.balanceAfter),
    })),
  });
});

export default router;
