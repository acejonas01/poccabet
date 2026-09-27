import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { toKobo, toNaira } from "../betting/money";
import { byUser, limit } from "../lib/rateLimit";
import { PaystackError, initializePayment, listBanks, paymentsAllowed, paystackTestMode, resolveAccount, validWebhookSignature } from "../lib/paystack";
import { MAX_WITHDRAWAL, MIN_WITHDRAWAL, OPEN, WithdrawalError, cancelWithdrawal, onTransferEvent, requestWithdrawal } from "../lib/withdrawals";
import { MAX_DEPOSIT, MIN_DEPOSIT, checkDeposit, creditDeposit, type DepositResult } from "../lib/deposits";

const router = Router();

// GET /api/wallet — balance in naira. `demo` = play money (simulation mode).
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const wallet = await prisma.wallet.findUnique({ where: { userId: req.userId! } });
  if (!wallet) return res.status(404).json({ error: "Wallet not found" });
  res.json({ balance: toNaira(wallet.balance), held: toNaira(wallet.lockedBalance), demo: SIMULATE }); // held = set aside for a withdrawal
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
  res.json({ enabled: paymentsAllowed(SIMULATE), testMode: paystackTestMode(), min: MIN_DEPOSIT, max: MAX_DEPOSIT });
});

// POST /api/wallet/deposit { amount (naira), returnTo (site origin) } → Paystack page to pay on.
const depositSchema = z.object({ amount: z.number().int().min(MIN_DEPOSIT).max(MAX_DEPOSIT), returnTo: z.string().max(200).optional() });
router.post("/deposit", requireAuth, limit("deposit-start", 10, 10, byUser), async (req: AuthedRequest, res) => {
  if (!paymentsAllowed(SIMULATE)) return res.status(503).json({ error: "Deposits aren't available yet", code: "PAYMENTS_OFF" });
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

// ---------- withdrawals ----------
const bankDto = (b: { bankCode: string; bankName: string; accountNumber: string; accountName: string } | null) =>
  b && { bankCode: b.bankCode, bankName: b.bankName, accountNumber: b.accountNumber, accountName: b.accountName };
const withdrawalDto = (w: { id: string; amount: number; status: string; reference: string; bankName: string; accountNumber: string; accountName: string; note: string | null; createdAt: Date; updatedAt: Date }) => ({
  id: w.id, amount: toNaira(w.amount), status: w.status, reference: w.reference, bankName: w.bankName,
  accountNumber: `••••${w.accountNumber.slice(-4)}`, accountName: w.accountName, note: w.note, createdAt: w.createdAt, updatedAt: w.updatedAt,
});
const wFail = (res: Response, err: unknown) => {
  if (err instanceof WithdrawalError) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again.", code: "SERVER_ERROR" });
};

// GET /api/wallet/withdraw — everything the Withdraw panel needs.
router.get("/withdraw", requireAuth, async (req: AuthedRequest, res) => {
  const [bank, recent, wallet] = await Promise.all([
    prisma.bankAccount.findUnique({ where: { userId: req.userId! } }),
    prisma.withdrawal.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.wallet.findUnique({ where: { userId: req.userId! }, select: { balance: true } }),
  ]);
  res.json({
    enabled: paymentsAllowed(SIMULATE), testMode: paystackTestMode(), min: MIN_WITHDRAWAL, max: MAX_WITHDRAWAL,
    balance: toNaira(wallet?.balance ?? 0), bank: bankDto(bank),
    open: recent.find((w) => OPEN.includes(w.status)) ? withdrawalDto(recent.find((w) => OPEN.includes(w.status))!) : null,
    recent: recent.map(withdrawalDto),
  });
});

// GET /api/wallet/banks — banks a withdrawal can go to.
router.get("/banks", requireAuth, async (_req, res) => {
  if (!paymentsAllowed(SIMULATE)) return res.status(503).json({ error: "Withdrawals aren't available yet", code: "PAYMENTS_OFF" });
  try { res.json({ banks: await listBanks() }); } catch (err) {
    console.error("bank list failed", err);
    res.status(502).json({ error: "Couldn't load the list of banks. Please try again.", code: "PAYMENT_PROVIDER" });
  }
});

// POST /api/wallet/bank-account/resolve { bankCode, accountNumber } → the name the bank has.
const bankSchema = z.object({ bankCode: z.string().trim().min(2).max(10), accountNumber: z.string().regex(/^\d{10}$/, "Account numbers have 10 digits") });
async function lookUp(req: AuthedRequest, res: Response) {
  if (!paymentsAllowed(SIMULATE)) { res.status(503).json({ error: "Withdrawals aren't available yet", code: "PAYMENTS_OFF" }); return null; }
  const body = bankSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues[0]?.message ?? "Check the bank details", code: "BAD_BANK" }); return null; }
  const bank = (await listBanks()).find((b) => b.code === body.data.bankCode);
  if (!bank) { res.status(400).json({ error: "Choose your bank from the list", code: "BAD_BANK" }); return null; }
  try {
    const r = await resolveAccount(body.data.accountNumber, bank.code);
    return { bankCode: bank.code, bankName: bank.name, accountNumber: body.data.accountNumber, accountName: r.account_name.trim().toUpperCase() };
  } catch (err) {
    if (err instanceof PaystackError) res.status(400).json({ error: "We couldn't find that account. Check the number and the bank.", code: "ACCOUNT_NOT_FOUND" });
    else { console.error("account resolve failed", err); res.status(502).json({ error: "Couldn't check the account right now. Please try again.", code: "PAYMENT_PROVIDER" }); }
    return null;
  }
}
router.post("/bank-account/resolve", requireAuth, limit("bank-resolve", 15, 10, byUser), async (req: AuthedRequest, res) => {
  const found = await lookUp(req, res);
  if (found) res.json(found);
});

// PUT /api/wallet/bank-account { bankCode, accountNumber } — save (looked up again, never trusted
// from the browser). Not while a withdrawal is on its way.
router.put("/bank-account", requireAuth, limit("bank-save", 5, 60, byUser), async (req: AuthedRequest, res) => {
  if (await prisma.withdrawal.findFirst({ where: { userId: req.userId!, status: { in: OPEN } }, select: { id: true } }))
    return res.status(409).json({ error: "You can change your bank account once your withdrawal is finished", code: "WITHDRAWAL_OPEN" });
  const found = await lookUp(req, res);
  if (!found) return;
  const bank = await prisma.bankAccount.upsert({ where: { userId: req.userId! }, create: { userId: req.userId!, ...found }, update: found });
  res.json({ bank: bankDto(bank) });
});

// POST /api/wallet/withdrawals { amount (naira) }
const withdrawSchema = z.object({ amount: z.number().int().min(MIN_WITHDRAWAL).max(MAX_WITHDRAWAL) });
router.post("/withdrawals", requireAuth, limit("withdraw", 10, 60, byUser), async (req: AuthedRequest, res) => {
  if (!paymentsAllowed(SIMULATE)) return res.status(503).json({ error: "Withdrawals aren't available yet", code: "PAYMENTS_OFF" });
  const body = withdrawSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: `Enter an amount from ₦${MIN_WITHDRAWAL.toLocaleString("en-US")} to ₦${MAX_WITHDRAWAL.toLocaleString("en-US")}`, code: "BAD_AMOUNT" });
  try {
    const r = await requestWithdrawal(req.userId!, toKobo(body.data.amount));
    res.status(201).json({ withdrawal: withdrawalDto(r.withdrawal), balance: toNaira(r.balance) });
  } catch (err) { wFail(res, err); }
});

// POST /api/wallet/withdrawals/:id/cancel — while it's still waiting for review.
router.post("/withdrawals/:id/cancel", requireAuth, async (req: AuthedRequest, res) => {
  const mine = await prisma.withdrawal.findFirst({ where: { id: String(req.params.id), userId: req.userId! }, select: { id: true } });
  if (!mine) return res.status(404).json({ error: "Withdrawal not found", code: "NOT_FOUND" });
  try {
    const w = await cancelWithdrawal(req.userId!, mine.id);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.userId! }, select: { balance: true } });
    res.json({ withdrawal: withdrawalDto(w), balance: toNaira(wallet.balance) });
  } catch (err) { wFail(res, err); }
});

// POST /api/payments/paystack/webhook — Paystack tells us about payments (signed). Mounted in
// app.ts with the raw body, before the JSON parser, so the signature can be checked.
export async function paystackWebhook(req: Request, res: Response) {
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || !validWebhookSignature(raw, req.header("x-paystack-signature"))) return res.sendStatus(401);
  let event: { event?: string; data?: { reference?: string; amount?: number; currency?: string; status?: string } };
  try { event = JSON.parse(raw.toString("utf8")); } catch { return res.sendStatus(400); }
  const d = event.data;
  if (event.event?.startsWith("transfer.") && d?.reference?.startsWith("PBW-")) {
    try {
      await onTransferEvent(d.reference, event.event);
    } catch (err) {
      console.error("paystack transfer webhook failed", err);
      return res.sendStatus(500); // Paystack retries
    }
  } else if (event.event === "charge.success" && d?.reference?.startsWith("PBD-") && typeof d.amount === "number") {
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
