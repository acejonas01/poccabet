// The logged-in user's own account: profile, edits, email verification, password, delete.
import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { formatNgPhone } from "../lib/phone";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { OtpError, consumeOtp, startOtp } from "../auth/otp";
import { toNaira } from "../betting/money";
import { RULES } from "../betting/rules";

const router = Router();
router.use(requireAuth);

const fail = (res: Response, err: unknown) => {
  if (err instanceof OtpError) return res.status(err.status).json({ error: err.message, code: err.code, ...err.details });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again.", code: "SERVER_ERROR" });
};

async function profile(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { wallet: true } });
  const byStatus = await prisma.bet.groupBy({ by: ["status"], where: { userId }, _count: { _all: true }, _sum: { stake: true, payout: true } });
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: u.displayName,
    email: u.email,
    emailVerified: !!u.emailVerifiedAt,
    phone: u.phone,
    phoneDisplay: u.phone ? formatNgPhone(u.phone) : null,
    phoneVerified: !!u.phoneVerifiedAt,
    dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : null,
    memberSince: u.createdAt,
    balance: toNaira(u.wallet?.balance ?? 0),
    demo: SIMULATE,
    // Welcome bonus: offered when set up (WELCOME_BONUS), claimed once, needs a verified email.
    bonus: { amount: toNaira(RULES.welcomeBonus), claimed: !!u.bonusClaimedAt },
    stats: {
      bets: byStatus.reduce((n, b) => n + b._count._all, 0),
      open: count("PENDING"),
      won: count("WON"),
      lost: count("LOST"),
      staked: toNaira(byStatus.reduce((n, b) => n + (b._sum.stake ?? 0), 0)),
      winnings: toNaira(byStatus.find((b) => b.status === "WON")?._sum.payout ?? 0),
    },
  };
}

// GET /api/me
router.get("/", async (req: AuthedRequest, res) => {
  try { res.json(await profile(req.userId!)); } catch (err) { fail(res, err); }
});

const name = (label: string) => z.string().trim().min(2, `Enter your ${label}`).max(40);
const editSchema = z.object({
  firstName: name("name").optional(),
  lastName: name("surname").optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional(),
});

// PATCH /api/me — name, surname, email. A new email has to be verified again.
router.patch("/", async (req: AuthedRequest, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid details", code: "INVALID_DETAILS" });
  const { firstName, lastName, email } = parsed.data;
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    const emailChanged = email !== undefined && email !== (me.email ?? "").toLowerCase();
    if (emailChanged) {
      const taken = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, NOT: { id: me.id } } });
      if (taken) return res.status(409).json({ error: "This email is already used by another account", code: "EMAIL_TAKEN" });
    }
    await prisma.user.update({
      where: { id: me.id },
      data: {
        ...(firstName ? { firstName, displayName: firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(emailChanged ? { email, emailVerifiedAt: null } : {}),
      },
    });
    res.json(await profile(me.id));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/me/email/start — send a 6-digit code to the account's email.
router.post("/email/start", async (req: AuthedRequest, res) => {
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    if (!me.email) return res.status(400).json({ error: "Add an email first", code: "NO_EMAIL" });
    if (me.emailVerifiedAt) return res.status(400).json({ error: "Your email is already verified", code: "ALREADY_VERIFIED" });
    res.json({ sentTo: me.email, ...(await startOtp(me.email.toLowerCase(), "EMAIL_VERIFY")) });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/me/email/verify { code }
router.post("/email/verify", async (req: AuthedRequest, res) => {
  const code = String(req.body?.code ?? "");
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code", code: "INVALID_CODE" });
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    if (!me.email) return res.status(400).json({ error: "Add an email first", code: "NO_EMAIL" });
    await consumeOtp(me.email.toLowerCase(), "EMAIL_VERIFY", code);
    await prisma.user.update({ where: { id: me.id }, data: { emailVerifiedAt: new Date() } });
    res.json(await profile(me.id));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/me/bonus — claim the welcome bonus: once per account, only with a verified email.
router.post("/bonus", async (req: AuthedRequest, res) => {
  if (!RULES.welcomeBonus) return res.status(404).json({ error: "There's no welcome bonus right now", code: "NO_BONUS" });
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    if (!me.emailVerifiedAt) return res.status(403).json({ error: "Verify your email to claim your welcome bonus", code: "EMAIL_NOT_VERIFIED" });
    const claimed = await prisma.$transaction(async (tx) => {
      // One UPDATE that only succeeds for an unclaimed, verified account: two taps can't claim twice.
      const mark = await tx.user.updateMany({
        where: { id: me.id, bonusClaimedAt: null, emailVerifiedAt: { not: null } },
        data: { bonusClaimedAt: new Date() },
      });
      if (mark.count !== 1) return false;
      const wallet = await tx.wallet.update({ where: { userId: me.id }, data: { balance: { increment: RULES.welcomeBonus } } });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: "BONUS", amount: RULES.welcomeBonus, balanceAfter: wallet.balance, reference: "welcome", status: "COMPLETED" },
      });
      return true;
    });
    if (!claimed) return res.status(409).json({ error: "You've already claimed your welcome bonus", code: "ALREADY_CLAIMED" });
    res.json(await profile(me.id));
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/me/password { currentPassword, newPassword }
router.post("/password", async (req: AuthedRequest, res) => {
  const parsed = z.object({ currentPassword: z.string(), newPassword: z.string().min(8, "Use at least 8 characters").max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid password", code: "INVALID_DETAILS" });
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    if (!(await bcrypt.compare(parsed.data.currentPassword, me.passwordHash))) {
      return res.status(401).json({ error: "Your current password is wrong", code: "WRONG_PASSWORD" });
    }
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) } });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

// DELETE /api/me { password, confirm: "DELETE" }
// Personal details are erased and login is blocked. Bets and the money ledger are kept, as a
// betting operator must. With real money, the wallet must be empty and no bets open first.
router.delete("/", async (req: AuthedRequest, res) => {
  const parsed = z.object({ password: z.string(), confirm: z.literal("DELETE") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Type DELETE and your password to confirm", code: "INVALID_DETAILS" });
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! }, include: { wallet: true } });
    if (!(await bcrypt.compare(parsed.data.password, me.passwordHash))) {
      return res.status(401).json({ error: "Wrong password", code: "WRONG_PASSWORD" });
    }
    if (!SIMULATE) {
      if ((me.wallet?.balance ?? 0) > 0) return res.status(409).json({ error: "Withdraw your balance before deleting your account", code: "BALANCE_NOT_EMPTY" });
      if (await prisma.bet.count({ where: { userId: me.id, status: "PENDING" } })) {
        return res.status(409).json({ error: "Wait for your open bets to settle before deleting your account", code: "OPEN_BETS" });
      }
    }
    await prisma.user.update({
      where: { id: me.id },
      data: {
        deletedAt: new Date(),
        email: null, emailVerifiedAt: null, phone: null, phoneVerifiedAt: null,
        firstName: null, lastName: null, dateOfBirth: null, referralCode: null,
        displayName: "Deleted user",
        passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10), // nobody can log in again
      },
    });
    res.json({ ok: true });
  } catch (err) {
    fail(res, err);
  }
});

export default router;
