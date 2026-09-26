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
import { everyone, limit } from "../lib/rateLimit";
import { SUSPENDED_MESSAGE } from "../middleware/auth";

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

const PHONE_TAKEN = { error: "This number already has an account. Log in instead.", code: "PHONE_TAKEN" };
const EMAIL_TAKEN = { error: "This email already has an account. Log in instead.", code: "EMAIL_TAKEN" };
const normEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();
// Older accounts may have saved their email with capitals, so emails match ignoring case.
// Limits on top of the per-number OTP rules: per IP, per login name, and a site-wide cap on
// codes sent (SMS costs money; this stops mass sends to many numbers).
const loginName = (req: { body?: any }) => normaliseNgPhone(String(req.body?.phone ?? "")) || normEmail(req.body?.email) || null;
const OTP_HOURLY_CAP = Number(process.env.OTP_HOURLY_CAP ?? 300);
const limits = {
  otpStart: [limit("otp-start-ip", 10, 60), limit("otp-start-all", OTP_HOURLY_CAP, 60, everyone)],
  otpVerify: limit("otp-verify-ip", 40, 15),
  signup: limit("signup-ip", 10, 60),
  login: [limit("login-ip", 30, 15), limit("login-name", 10, 15, loginName)],
};
const findByEmail = (email: string) => prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { wallet: true } });

// POST /api/auth/otp/start { phone, email?, purpose: "signup" } — the email (if sent) is checked
// too, so nobody verifies their number only to be told the email is taken.
router.post("/otp/start", ...limits.otpStart, async (req, res) => {
  const phone = normaliseNgPhone(String(req.body?.phone ?? ""));
  if (!phone) return res.status(400).json({ error: "Enter a valid Nigerian mobile number", code: "INVALID_PHONE" });
  const email = normEmail(req.body?.email);
  try {
    if (await prisma.user.findUnique({ where: { phone } })) return res.status(409).json(PHONE_TAKEN);
    if (email && (await findByEmail(email))) return res.status(409).json(EMAIL_TAKEN);
    res.json({ phone, display: formatNgPhone(phone), ...(await startOtp(phone, "SIGNUP")) });
  } catch (err) {
    otpFail(res, err);
  }
});

// POST /api/auth/otp/verify { phone, code } → { verificationToken }
router.post("/otp/verify", limits.otpVerify, async (req, res) => {
  const phone = normaliseNgPhone(String(req.body?.phone ?? ""));
  const code = String(req.body?.code ?? "");
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the 6-digit code", code: "INVALID_CODE" });
  try {
    res.json({ verificationToken: await verifyOtp(phone, "SIGNUP", code) });
  } catch (err) {
    otpFail(res, err);
  }
});

// Whole years old on `today` for a yyyy-mm-dd birth date (null if the date doesn't exist).
export function ageOn(dob: string, today: Date): number | null {
  const [y, m, d] = dob.split("-").map(Number);
  const born = new Date(Date.UTC(y, m - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== m - 1 || born.getUTCDate() !== d || born > today) return null;
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d)) age--;
  return age;
}

const name = (label: string) => z.string().trim().min(2, `Enter your ${label}`).max(40);
const phoneSignupSchema = z.object({
  verificationToken: z.string().min(10),
  firstName: name("name"),
  lastName: name("surname"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(100),
  ageConfirmed: z.literal(true, { message: "You must be over 18 to open an account" }),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth"),
  referralCode: z.string().trim().max(32).optional(), // promotion code
});

// POST /api/auth/signup/phone — create the account for a verified number.
router.post("/signup/phone", limits.signup, async (req, res) => {
  const parsed = phoneSignupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid details", code: "INVALID_DETAILS" });
  const phone = phoneFromToken(parsed.data.verificationToken, "SIGNUP");
  if (!phone) return res.status(401).json({ error: "Your verification expired. Please verify your number again.", code: "VERIFICATION_EXPIRED" });
  const { firstName, lastName, email, password, referralCode, dateOfBirth } = parsed.data;
  const age = ageOn(dateOfBirth, new Date());
  if (age === null || age > 120) return res.status(400).json({ error: "Enter a valid date of birth", code: "INVALID_DETAILS" });
  if (age < 18) return res.status(400).json({ error: "You must be 18 or older to open an account", code: "UNDER_18" });
  try {
    if (await prisma.user.findUnique({ where: { phone } })) return res.status(409).json(PHONE_TAKEN);
    if (await findByEmail(email)) return res.status(409).json(EMAIL_TAKEN);
    // (Two sign-ups racing for the same number or email are still caught below by the unique indexes.)
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        phone,
        phoneVerifiedAt: now,
        email,
        firstName,
        lastName,
        ageConfirmedAt: now,
        dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`),
        referralCode: referralCode || null,
        displayName: firstName,
        passwordHash: await bcrypt.hash(password, 10),
        wallet: newWallet(),
      },
      include: { wallet: true },
    });
    sendSession(res, user, 201);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json(String(err.meta?.target ?? "").includes("email") ? EMAIL_TAKEN : PHONE_TAKEN);
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

router.post("/signup", limits.signup, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, displayName } = parsed.data;

  const existing = await findByEmail(email);
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

router.post("/login", ...limits.login, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Enter your phone number and password", code: "INVALID_DETAILS" });
  }
  const { password } = parsed.data;
  const email = parsed.data.email?.trim().toLowerCase();
  const phone = parsed.data.phone ? normaliseNgPhone(parsed.data.phone) : null;
  if (!phone && !email) return res.status(400).json({ error: "Enter your phone number and password", code: "INVALID_DETAILS" });

  const user = phone ? await prisma.user.findUnique({ where: { phone }, include: { wallet: true } }) : await findByEmail(email!);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: phone ? "Wrong phone number or password" : "Wrong email or password", code: "INVALID_CREDENTIALS" });
  }
  if (user.suspendedAt) return res.status(403).json({ error: SUSPENDED_MESSAGE, code: "ACCOUNT_SUSPENDED" });
  sendSession(res, user);
});

export default router;
