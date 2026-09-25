import { Router } from "express";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { formatNaira, toNaira } from "../betting/money";
import { RULES } from "../betting/rules";

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

// POST /api/wallet/demo-topup — play money for testing. Only exists in simulation mode;
// real deposits (Paystack/Flutterwave) replace it.
router.post("/demo-topup", requireAuth, async (req: AuthedRequest, res) => {
  if (!SIMULATE) return res.status(404).json({ error: "Not available" });
  const result = await prisma.$transaction(async (tx) => {
    const topped = await tx.wallet.updateMany({
      where: { userId: req.userId!, balance: { lt: RULES.demoTopUpBelow } },
      data: { balance: { increment: RULES.demoTopUp } },
    });
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: req.userId! } });
    if (topped.count === 1) {
      await tx.transaction.create({
        data: { walletId: wallet.id, type: "DEMO_TOPUP", amount: RULES.demoTopUp, balanceAfter: wallet.balance, status: "COMPLETED" },
      });
    }
    return { added: topped.count === 1, balance: wallet.balance };
  });
  if (!result.added) {
    return res.status(400).json({ error: `Demo top-ups stop at ${formatNaira(RULES.demoTopUpBelow)}`, code: "TOPUP_LIMIT", balance: toNaira(result.balance) });
  }
  res.json({ balance: toNaira(result.balance) });
});

export default router;
