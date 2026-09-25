import { Router, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { bookSlip, loadSlip } from "../betting/booking";
import { normaliseCode, newTicket } from "../betting/codes";
import { toKobo, toNaira } from "../betting/money";
import { BetError, betDto, betInclude, placeBets } from "../betting/placeBet";
import { maybeSettle } from "../betting/settle";

// Catch up on settlement before showing bets (a sleeping server may have missed some), but
// never make the user wait more than a couple of seconds for it.
const catchUp = () => Promise.race([maybeSettle(), new Promise((r) => setTimeout(r, 2500))]);

const router = Router();

function sendError(res: Response, err: unknown) {
  if (err instanceof BetError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Your balance hasn't changed.", code: "SERVER_ERROR" });
}

const legSchema = z.object({
  matchId: z.string().min(1).max(64),
  market: z.string().min(1).max(16),
  selection: z.string().min(1).max(16),
});

const placeSchema = z.object({
  mode: z.enum(["single", "multiple"]),
  stake: z.number().positive(), // naira, per bet
  selections: z.array(legSchema.extend({ odds: z.number().positive() })).min(1).max(100),
  acceptOdds: z.enum(["higher", "any", "none"]).default("higher"),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

// Old Theme D slip: database outcomes by id.
const legacySchema = z.object({
  stake: z.number().positive(),
  outcomeIds: z.array(z.string()).min(1),
});

// POST /api/bets — place bets from the slip. Singles = one bet per selection; multiple = one accumulator.
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  if (Array.isArray(req.body?.outcomeIds)) return placeLegacy(req, res);
  const parsed = placeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid bet slip", code: "INVALID_SLIP", details: parsed.error.flatten() });
  const { stake, ...rest } = parsed.data;
  try {
    const result = await placeBets(req.userId!, { ...rest, stakeKobo: toKobo(stake) });
    res.status(result.repeated ? 200 : 201).json(result);
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/bets — my bets, newest first.
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  await catchUp();
  const bets = await prisma.bet.findMany({
    where: { userId: req.userId! },
    include: betInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ bets: bets.map(betDto) });
});

// GET /api/bets/ticket/:ticket — "Check a bet": any ticket's status, no login, no personal details.
router.get("/ticket/:ticket", async (req, res) => {
  const ticket = normaliseCode(req.params.ticket);
  const bet = ticket ? await prisma.bet.findUnique({ where: { ticket }, include: betInclude }) : null;
  if (!bet) return res.status(404).json({ error: "No bet found with that ticket ID", code: "TICKET_NOT_FOUND" });
  const { id: _id, source: _source, ...pub } = betDto(bet);
  res.json({ bet: pub });
});

// POST /api/bets/book — save a slip under a booking code (no login needed).
router.post("/book", async (req, res) => {
  const parsed = z.object({ selections: z.array(legSchema).min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid bet slip", code: "INVALID_SLIP" });
  try {
    res.status(201).json(await bookSlip(parsed.data.selections));
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/bets/book/:code — load a booked slip with today's prices.
router.get("/book/:code", async (req, res) => {
  try {
    res.json(await loadSlip(req.params.code));
  } catch (err) {
    sendError(res, err);
  }
});

// ---------- old Theme D path (database events) ----------
async function placeLegacy(req: AuthedRequest, res: Response) {
  const parsed = legacySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const stake = toKobo(parsed.data.stake);
  const { outcomeIds } = parsed.data;
  try {
    const bet = await prisma.$transaction(async (tx) => {
      const outcomes = await tx.outcome.findMany({ where: { id: { in: outcomeIds } } });
      if (outcomes.length !== outcomeIds.length) throw new BetError("OUTCOME_NOT_FOUND", "One or more selections not found");
      const debit = await tx.wallet.updateMany({ where: { userId: req.userId!, balance: { gte: stake } }, data: { balance: { decrement: stake } } });
      if (debit.count !== 1) throw new BetError("INSUFFICIENT_FUNDS", "Insufficient balance", 402);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: req.userId! } });
      const odds = outcomes.reduce((acc, o) => acc * o.odds, 1);
      const created = await tx.bet.create({
        data: {
          userId: req.userId!,
          ticket: newTicket(),
          stake,
          totalOdds: Math.round(odds * 100) / 100,
          potentialPayout: Math.floor(stake * odds),
          type: outcomeIds.length > 1 ? "ACCUMULATOR" : "SINGLE",
          status: "PENDING",
          selections: { create: outcomes.map((o) => ({ outcomeId: o.id, oddsAtPlacement: o.odds, result: "PENDING" })) },
        },
        include: betInclude,
      });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: "BET_STAKE", amount: -stake, balanceAfter: wallet.balance, reference: created.id, status: "COMPLETED" },
      });
      return { created, balance: wallet.balance };
    });
    res.status(201).json({ bet: betDto(bet.created), balance: toNaira(bet.balance) });
  } catch (err) {
    sendError(res, err);
  }
}

export default router;
