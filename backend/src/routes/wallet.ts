import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { toKobo, toNaira } from "../betting/money";
import { byUser, limit } from "../lib/rateLimit";
import { initializePayment, paystackReady, paystackTestMode, validWebhookSignature } from "../lib/paystack";
import { MAX_DEPOSIT, MIN_DEPOSIT, checkDeposit, creditDeposit, type DepositResult } from "../lib/deposits";

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

// ---------- deposits (Paystack) ----------
// Where Paystack sends the player back: the site they came from, if it's one of ours.
const LOCAL_SITE = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/;
function siteFor(returnTo: string | undefined) {
  const allowed = process.env.FRONTEND_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
  if (returnTo && (allowed ? allowed.includes(returnTo) : LOCAL_SITE.test(returnTo))) return returnTo;
  return allowed?.[0] ?? "http://localhost:3000";
}
const depositDto = (reference: string, r: DepositResult) => ({
  reference, status: r.status,
  ...(r.status === "COMPLETED" ? { amount: toNaira(r.amount), balance: r.balance === null ? null : toNaira(r.balance) } : {}),
});

// GET /api/wallet/deposit — whether deposits are on, and the limits (for the deposit panel).
router.get("/deposit", requireAuth, (_req, res) => {
  res.json({ enabled: paystackReady(), testMode: paystackTestMode(), min: MIN_DEPOSIT, max: MAX_DEPOSIT });
});

// POST /api/wallet/deposit { amount (naira), returnTo (site origin) } → Paystack page to pay on.
const depositSchema = z.object({ amount: z.number().int().min(MIN_DEPOSIT).max(MAX_DEPOSIT), returnTo: z.string().max(200).optional() });
router.post("/deposit", requireAuth, limit("deposit-start", 10, 10, byUser), async (req: AuthedRequest, res) => {
  if (!paystackReady()) return res.status(503).json({ error: "Deposits aren't available yet", code: "PAYMENTS_OFF" });
  const body = depositSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: `Enter an amount from ₦${MIN_DEPOSIT.toLocaleString("en-US")} to ₦${MAX_DEPOSIT.toLocaleString("en-US")}`, code: "BAD_AMOUNT" });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! }, select: { email: true, customerNo: true, wallet: { select: { id: true } } } });
  if (!user.wallet) return res.status(404).json({ error: "Wallet not found" });
  const amountKobo = toKobo(body.data.amount);
  const reference = `PBD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await prisma.transaction.create({ data: { walletId: user.wallet.id, type: "DEPOSIT", amount: amountKobo, reference, status: "PENDING" } });
  try {
    const page = await initializePayment({
      // Paystack needs an email; phone-only players get their customer number as a stand-in.
      email: user.email ?? `${user.customerNo.toLowerCase()}@players.poccabet.app`,
      amountKobo, reference,
      callbackUrl: `${siteFor(body.data.returnTo)}/account?deposit=${encodeURIComponent(reference)}`,
      metadata: { userId: req.userId, customerNo: user.customerNo },
    });
    res.status(201).json({ reference, authorizationUrl: page.authorization_url });
  } catch (err) {
    console.error("deposit start failed", err);
    await prisma.transaction.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
    res.status(502).json({ error: "Couldn't reach the payment provider. Please try again.", code: "PAYMENT_PROVIDER" });
  }
});

// GET /api/wallet/deposit/:reference — after Paystack sends the player back: did it go through?
router.get("/deposit/:reference", requireAuth, limit("deposit-check", 60, 10, byUser), async (req: AuthedRequest, res) => {
  const reference = String(req.params.reference).slice(0, 64);
  const row = await prisma.transaction.findFirst({ where: { type: "DEPOSIT", reference, wallet: { userId: req.userId! } }, select: { id: true } });
  if (!row) return res.status(404).json({ error: "Deposit not found", code: "NOT_FOUND" });
  try {
    res.json(depositDto(reference, await checkDeposit(reference)));
  } catch (err) {
    console.error("deposit check failed", err);
    res.status(502).json({ error: "Couldn't confirm the payment yet. Please check again in a moment.", code: "PAYMENT_PROVIDER" });
  }
});

// POST /api/payments/paystack/webhook — Paystack tells us about payments (signed). Mounted in
// app.ts with the raw body, before the JSON parser, so the signature can be checked.
export async function paystackWebhook(req: Request, res: Response) {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !validWebhookSignature(raw, req.header("x-paystack-signature"))) return res.sendStatus(401);
  let event: { event?: string; data?: { reference?: string; amount?: number; currency?: string; status?: string } };
  try { event = JSON.parse(raw.toString("utf8")); } catch { return res.sendStatus(400); }
  const d = event.data;
  if (event.event === "charge.success" && d?.reference?.startsWith("PBD-") && typeof d.amount === "number") {
    try {
      const r = await creditDeposit(d.reference, d.amount, d.currency ?? "");
      if (r.status !== "COMPLETED") console.warn(`paystack webhook ${d.reference}: ${r.status}`);
    } catch (err) {
      console.error("paystack webhook failed", err);
      return res.sendStatus(500); // Paystack retries
    }
  }
  res.sendStatus(200);
}

export default router;
