import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { toNaira } from "../betting/money";
import { RULES } from "../betting/rules";

const router = Router();

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

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      // Play money in simulation mode (logged in the ledger); real wallets start at zero.
      wallet: {
        create: {
          balance: RULES.startingBalance,
          ...(RULES.startingBalance
            ? { transactions: { create: { type: "DEMO_TOPUP", amount: RULES.startingBalance, balanceAfter: RULES.startingBalance, status: "COMPLETED" } } }
            : {}),
        },
      },
    },
    include: { wallet: true },
  });

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    wallet: { balance: toNaira(user.wallet!.balance), demo: SIMULATE },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email }, include: { wallet: true } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: "7d" });

  res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    wallet: { balance: toNaira(user.wallet!.balance), demo: SIMULATE },
  });
});

export default router;
