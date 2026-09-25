import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { Prisma, type User, type Wallet } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { formatNgPhone, normaliseNgPhone } from "../lib/phone";
import { toNaira } from "../betting/money";
import { RULES } from "../betting/rules";
import { OtpError, phoneFromToken, startOtp, verifyOtp } from "../auth/otp";

const router = Router();

// New wallets: play money in simulation mode (logged in the ledger); real wallets start at zero.
const newWallet = () => ({
  create: {
    balance: RULES.startingBalance,
    ...(RULES.startingBalance
      ? { transactions: { create: { type: "DEMO_TOPUP", amount: RULES.startingBalance, balanceAfter: RULES.startingBalance, status: "COMPLETED" } } }
      : {}),
  },
});

function sendSession(res: Response, user: User & { wallet: Wallet | null }, status = 200) {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });
  res.status(status).json({
    token,
    user: { id: user.id, email: user.email, phone: user.phone, displayName: user.displayName },
    wallet: { balance: toNaira(user.wallet!.balance), demo: SIMULATE },
  });
}

const otpFail = (res: Response, err: unknown) => {
  if (err instanceof OtpError) return res.status(err.status).json({ error: err.message, code: err.code, ...err.details });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again.", code: "SERVER_ERROR" });
};

// ---------- phone sign-up: 1) send a code  2) check it  3) create the account ----------

// POST /api/auth/otp/start { phone, purpose: "signup" }
router.post("/otp/start", async (req, res) => {
  const phone = normaliseNgPhone(String(req.body?.phone ?? ""));
  if (!phone) return res.status(400).json({ error: "Enter a valid Nigerian mobile number", code: "INVALID_PHONE" });
  try {
    if (await prisma.user.findUnique({ where: { phone } })) {
      return res.status(409).json({ error: "This number already has an account. Log in instead.", code: "PHONE_TAKEN" });
    }
    res.json({ phone, display: formatNgPhone(phone), ...(await startOtp(phone, "SIGNUP")) });
  } catch (err) {
    otpFail(res, err);
  }
});

// POST /api/auth/otp/verify { phone, code } → { verificationToken }
router.post("/otp/verify", async (req, res) => {
  const phone = normaliseNgPhone(String(req.body?.phone ?? ""));
  const code = String(req.body?.code ?? "");
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code", code: "INVALID_CODE" });
  try {
    res.json({ verificationToken: await verifyOtp(phone, "SIGNUP", code) });
  } catch (err) {
    otpFail(res, err);
  }
});

const phoneSignupSchema = z.object({
  verificationToken: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters").max(100),
  displayName: z.string().trim().max(40).optional(),
  referralCode: z.string().trim().max(32).optional(),
});

// POST /api/auth/signup/phone — create the account for a verified number.
router.post("/signup/phone", async (req, res) => {
  const parsed = phoneSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid details", code: "INVALID_DETAILS" });
  const phone = phoneFromToken(parsed.data.verificationToken, "SIGNUP");
  if (!phone) return res.status(401).json({ error: "Your verification expired. Please verify your number again.", code: "VERIFICATION_EXPIRED" });
  const { password, displayName, referralCode } = parsed.data;
  try {
    if (await prisma.user.findUnique({ where: { phone } })) {
      return res.status(409).json({ error: "This number already has an account. Log in instead.", code: "PHONE_TAKEN" });
    }
    // (Two sign-ups racing for the same number are still caught below by the unique index.)
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: new Date(),
        referralCode: referralCode || null,
        displayName: displayName && displayName.length >= 2 ? displayName : `Player ${phone.slice(-4)}`,
        passwordHash: await bcrypt.hash(password, 10),
        wallet: newWallet(),
      },
      include: { wallet: true },
    });
    sendSession(res, user, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "This number already has an account. Log in instead.", code: "PHONE_TAKEN" });
    }
    otpFail(res, err);
  }
});

// ---------- email sign-up (older accounts / classic layout) ----------

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
});

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10), displayName, wallet: newWallet() },
    include: { wallet: true },
  });
  sendSession(res, user, 201);
});

// ---------- login: phone number (or, for older accounts, email) + password ----------

const loginSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter your phone number and password", code: "INVALID_DETAILS" });
  }
  const { email, password } = parsed.data;
  const phone = parsed.data.phone ? normaliseNgPhone(parsed.data.phone) : null;
  if (!phone && !email) return res.status(400).json({ error: "Enter your phone number and password", code: "INVALID_DETAILS" });

  const user = await prisma.user.findUnique({ where: phone ? { phone } : { email: email! }, include: { wallet: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: phone ? "Wrong phone number or password" : "Wrong email or password", code: "INVALID_CREDENTIALS" });
  }
  sendSession(res, user);
});

export default router;
