// Admin panel API (/api/admin). Every route needs an admin account (User.role = "ADMIN");
// every change is written to the audit log in the same database transaction.
import { Router, type NextFunction, type Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SIMULATE } from "../lib/feedMode";
import { normaliseNgPhone, formatNgPhone } from "../lib/phone";
import { byUser, limit } from "../lib/rateLimit";
import { closeAccount } from "../lib/closeAccount";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireAdminKey } from "../middleware/admin";
import { toKobo, toNaira } from "../betting/money";
import { currentMatches } from "../betting/feed";
import { gradeSelection } from "../betting/grade";
import { settleBet } from "../betting/settle";
import { forgetSuspensions } from "../betting/suspensions";
import { recordResult } from "../betting/catalog";
import { normaliseCode } from "../betting/codes";
import { OPEN as OPEN_WITHDRAWAL, WithdrawalError, approveWithdrawal, checkWithdrawal, nameMatches, rejectWithdrawal } from "../lib/withdrawals";

const router = Router();

// ---------- access ----------
async function requireAdminRole(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: { role: true } });
    if (me?.role !== "ADMIN") return res.status(403).json({ error: "Admins only", code: "NOT_ADMIN" });
    next();
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/grant { phone | email, role } — make someone an admin (or remove it) with the
// server's ADMIN_API_KEY. This is how the first admin is created.
router.post("/grant", requireAdminKey, async (req, res) => {
  const role = req.body?.role === "USER" ? "USER" : "ADMIN";
  const phone = req.body?.phone ? normaliseNgPhone(String(req.body.phone)) : null;
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;
  const user = phone
    ? await prisma.user.findUnique({ where: { phone } })
    : email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } }) : null;
  if (!user || user.deletedAt) return res.status(404).json({ error: "No account with that phone number or email", code: "NOT_FOUND" });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role } }),
    prisma.auditLog.create({ data: { adminId: "server-key", action: role === "ADMIN" ? "ROLE_GRANT" : "ROLE_REVOKE", targetType: "USER", targetId: user.id, details: { role } } }),
  ]);
  res.json({ ok: true, userId: user.id, role });
});

router.use(requireAuth, requireAdminRole, limit("admin", 600, 10, byUser));

type Tx = Prisma.TransactionClient;
const audit = (tx: Tx, req: AuthedRequest, action: string, targetType: string, targetId: string, details?: Prisma.InputJsonValue) =>
  tx.auditLog.create({ data: { adminId: req.userId!, action, targetType, targetId, details } });

const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(300);
const fail = (res: Response, err: unknown) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request", code: "INVALID" });
  if (err instanceof AdminError) return res.status(err.status).json({ error: err.message, code: err.code });
  console.error(err);
  res.status(500).json({ error: "Something went wrong", code: "SERVER_ERROR" });
};
class AdminError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
// Audit rows with the admin's display name.
async function named<T extends { adminId: string }>(rows: T[]) {
  const admins = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.adminId))] } }, select: { id: true, displayName: true } });
  const name = new Map(admins.map((a) => [a.id, a.displayName]));
  return rows.map((r) => ({ ...r, admin: name.get(r.adminId) ?? (r.adminId === "server-key" ? "Server key" : r.adminId) }));
}
const page = (v: unknown) => Math.max(0, Math.min(1000, Number(v) || 0));
const PAGE = 25;

// Lagos days (UTC+1, no daylight saving): start of today and N days back.
const DAY = 86_400_000;
const lagosDayStart = (daysAgo = 0) => {
  const now = Date.now() + 3_600_000;
  return new Date(Math.floor(now / DAY) * DAY - 3_600_000 - daysAgo * DAY);
};

// ---------- me ----------
router.get("/me", async (req: AuthedRequest, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! }, select: { id: true, displayName: true, role: true } });
  res.json({ ...me, mode: SIMULATE ? "simulation" : "live" });
});

// ---------- dashboard ----------
router.get("/stats", async (_req, res) => {
  try {
    const today = lagosDayStart(0), week = lagosDayStart(6);
    const betsSince = (since: Date) => prisma.bet.aggregate({ where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { stake: true } });
    const settledSince = (since?: Date) => prisma.bet.aggregate({
      where: { status: { in: ["WON", "LOST", "VOID"] }, ...(since ? { settledAt: { gte: since } } : {}) },
      _sum: { stake: true, payout: true }, _count: { _all: true },
    });
    const [users, usersToday, usersWeek, suspended, betsToday, betsWeek, ggrToday, ggrWeek, ggrAll, open, wallets, bonuses, byDay] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: today } } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: week } } }),
      prisma.user.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
      betsSince(today), betsSince(week),
      settledSince(today), settledSince(week), settledSince(),
      prisma.bet.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { stake: true, potentialPayout: true } }),
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.transaction.aggregate({ where: { type: "BONUS" }, _sum: { amount: true } }),
      // Last 14 Lagos days: bets placed and amount staked per day.
      prisma.$queryRaw<{ day: string; bets: bigint; stake: bigint | null }[]>`
        SELECT to_char((placed_at + interval '1 hour')::date, 'YYYY-MM-DD') AS day, count(*) AS bets, sum(stake) AS stake
        FROM bets WHERE placed_at >= ${lagosDayStart(13)} GROUP BY 1 ORDER BY 1`,
    ]);
    const ggr = (a: typeof ggrAll) => toNaira((a._sum.stake ?? 0) - (a._sum.payout ?? 0));
    res.json({
      mode: SIMULATE ? "simulation" : "live",
      users: { total: users, today: usersToday, week: usersWeek, suspended },
      bets: {
        today: { count: betsToday._count._all, stake: toNaira(betsToday._sum.stake ?? 0) },
        week: { count: betsWeek._count._all, stake: toNaira(betsWeek._sum.stake ?? 0) },
      },
      ggr: { today: ggr(ggrToday), week: ggr(ggrWeek), all: ggr(ggrAll) },
      open: { count: open._count._all, stake: toNaira(open._sum.stake ?? 0), liability: toNaira(open._sum.potentialPayout ?? 0) },
      playerBalances: toNaira(wallets._sum.balance ?? 0),
      bonusesPaid: toNaira(bonuses._sum.amount ?? 0),
      byDay: byDay.map((d) => ({ day: d.day, bets: Number(d.bets), stake: toNaira(Number(d.stake ?? 0)) })),
    });
  } catch (err) {
    fail(res, err);
  }
});

// ---------- users ----------
const userRow = { id: true, customerNo: true, chatMutedUntil: true, displayName: true, firstName: true, lastName: true, email: true, phone: true, role: true, suspendedAt: true, suspendedReason: true, deletedAt: true, createdAt: true, wallet: { select: { balance: true } }, _count: { select: { bets: true } } } as const;
const userDto = (u: Prisma.UserGetPayload<{ select: typeof userRow }>) => ({
  id: u.id, customerNo: u.customerNo, chatMutedUntil: u.chatMutedUntil, name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.displayName, email: u.email,
  phone: u.phone ? formatNgPhone(u.phone) : null, role: u.role, suspended: !!u.suspendedAt, suspendedReason: u.suspendedReason,
  deleted: !!u.deletedAt, createdAt: u.createdAt, balance: toNaira(u.wallet?.balance ?? 0), bets: u._count.bets,
});

function userSearch(q: string): Prisma.UserWhereInput {
  if (!q) return {};
  const phone = normaliseNgPhone(q);
  const text = { contains: q, mode: "insensitive" as const };
  const customer = /^(pc)?[-\s]?(\d{7})$/i.exec(q); // "PC-4829135", "pc4829135" or just the 7 digits
  return { OR: [
    ...(phone ? [{ phone }] : []), ...(customer ? [{ customerNo: `PC-${customer[2]}` }] : []), { id: q }, { email: text }, { displayName: text }, { firstName: text }, { lastName: text },
    // deleted accounts: by the identity kept in the sealed archive
    { closedAccount: { is: { OR: [...(phone ? [{ phone }] : []), { email: text }, { firstName: text }, { lastName: text }, { displayName: text }] } } },
  ] };
}

router.get("/users", async (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 80);
  const filter = String(req.query.filter ?? "");
  const where: Prisma.UserWhereInput = {
    ...userSearch(q),
    // All = every account; Active = not suspended or deleted; the other tabs are what they say.
    ...(filter === "active" ? { suspendedAt: null, deletedAt: null }
      : filter === "suspended" ? { suspendedAt: { not: null }, deletedAt: null }
      : filter === "deleted" ? { deletedAt: { not: null } }
      : filter === "admins" ? { role: "ADMIN", deletedAt: null }
      : {}),
  };
  const p = page(req.query.page);
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: userRow, orderBy: { createdAt: "desc" }, skip: p * PAGE, take: PAGE }),
  ]);
  // A search that found deleted accounts looked into the identity archive: keep a record of it.
  const found = users.filter((u) => u.deletedAt).map((u) => u.id);
  if (q && found.length) await audit(prisma, req as AuthedRequest, "ARCHIVE_SEARCH", "USER", found[0], { query: q, matches: found.length });
  res.json({ total, page: p, pageSize: PAGE, users: users.map(userDto) });
});

router.get("/users/:id", async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.findUnique({ where: { id }, select: { ...userRow, dateOfBirth: true, emailVerifiedAt: true, phoneVerifiedAt: true, referralCode: true, bonusClaimedAt: true } });
  if (!u) return res.status(404).json({ error: "User not found", code: "NOT_FOUND" });
  const [stats, bets, txs, log, closed] = await Promise.all([
    prisma.bet.aggregate({ where: { userId: id }, _sum: { stake: true, payout: true } }),
    prisma.bet.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { selections: true } } } }),
    prisma.transaction.findMany({ where: { wallet: { userId: id } }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.auditLog.findMany({ where: { targetType: "USER", targetId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.closedAccount.findUnique({ where: { userId: id }, select: { closedAt: true, closedBy: true, closedByAdmin: true, reason: true, retainUntil: true } }),
  ]);
  const closedBy = closed?.closedByAdmin ? (await named([{ adminId: closed.closedByAdmin }]))[0].admin : null;
  res.json({
    ...userDto(u),
    closed: closed ? { closedAt: closed.closedAt, by: closed.closedBy, byName: closedBy, reason: closed.reason, retainUntil: closed.retainUntil } : null,
    dateOfBirth: u.dateOfBirth?.toISOString().slice(0, 10) ?? null, emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt,
    referralCode: u.referralCode, bonusClaimed: !!u.bonusClaimedAt,
    totals: { staked: toNaira(stats._sum.stake ?? 0), paidOut: toNaira(stats._sum.payout ?? 0), net: toNaira((stats._sum.stake ?? 0) - (stats._sum.payout ?? 0)) },
    bets: bets.map(betRowDto),
    transactions: txs.map((t) => ({ id: t.id, type: t.type, amount: toNaira(t.amount), balanceAfter: t.balanceAfter == null ? null : toNaira(t.balanceAfter), reference: t.reference, status: t.status, createdAt: t.createdAt })),
    audit: await named(log),
  });
});

// The sealed identity of a deleted account (legal / AML requests). Needs a reason; every read is audited.
router.post("/users/:id/identity", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const id = String(req.params.id);
    const a = await prisma.closedAccount.findUnique({ where: { userId: id } });
    if (!a) throw new AdminError("NOT_FOUND", "No archived identity for this account (deleted before the archive existed, or past its retention period)", 404);
    await audit(prisma, req, "IDENTITY_REVEAL", "USER", id, { reason: why });
    const closedByName = a.closedByAdmin ? (await named([{ adminId: a.closedByAdmin }]))[0].admin : null;
    const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
    const { customerNo } = await prisma.user.findUniqueOrThrow({ where: { id }, select: { customerNo: true } });
    res.json({
      userId: id, customerNo,
      closure: { closedAt: a.closedAt, closedBy: a.closedBy, closedByName, reason: a.reason, retainUntil: day(a.retainUntil) },
      identity: {
        displayName: a.displayName, firstName: a.firstName, lastName: a.lastName, dateOfBirth: day(a.dateOfBirth),
        phone: a.phone, phoneVerifiedAt: a.phoneVerifiedAt, email: a.email, emailVerifiedAt: a.emailVerifiedAt,
        ageConfirmedAt: a.ageConfirmedAt, referralCode: a.referralCode, signupSource: a.signupSource, registeredAt: a.registeredAt,
        suspendedAt: a.suspendedAt, suspendedReason: a.suspendedReason,
      },
      access: { lastLoginAt: a.lastLoginAt, lastLoginIp: a.lastLoginIp, lastUserAgent: a.lastUserAgent, signupIp: a.signupIp },
      money: {
        balance: toNaira(a.balance), deposits: toNaira(a.deposits), withdrawals: toNaira(a.withdrawals), bonuses: toNaira(a.bonuses),
        staked: toNaira(a.staked), paidOut: toNaira(a.paidOut), bets: a.bets, openBets: a.openBets, firstBetAt: a.firstBetAt, lastBetAt: a.lastBetAt,
      },
    });
  } catch (err) { fail(res, err); }
});

router.post("/users/:id/suspend", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const id = String(req.params.id);
    if (id === req.userId) throw new AdminError("SELF", "You can't suspend your own account");
    await prisma.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id, suspendedAt: null }, data: { suspendedAt: new Date(), suspendedReason: why } });
      if (r.count !== 1) throw new AdminError("NO_CHANGE", "Account not found or already suspended", 409);
      await audit(tx, req, "USER_SUSPEND", "USER", id, { reason: why });
    });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

router.post("/users/:id/unsuspend", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const id = String(req.params.id);
    await prisma.$transaction(async (tx) => {
      const r = await tx.user.updateMany({ where: { id, suspendedAt: { not: null } }, data: { suspendedAt: null, suspendedReason: null } });
      if (r.count !== 1) throw new AdminError("NO_CHANGE", "Account not found or not suspended", 409);
      await audit(tx, req, "USER_UNSUSPEND", "USER", id, { reason: why });
    });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// Credit (+) or debit (−) a wallet, in naira, with a reason. Never below zero.
router.post("/users/:id/adjust", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ amount: z.number().refine((v) => v !== 0 && Math.abs(v) <= 10_000_000, "Enter an amount (up to ₦10,000,000)"), reason }).parse(req.body);
    const id = String(req.params.id);
    const kobo = toKobo(body.amount);
    const balance = await prisma.$transaction(async (tx) => {
      const moved = await tx.wallet.updateMany({
        where: { userId: id, ...(kobo < 0 ? { balance: { gte: -kobo } } : {}) },
        data: { balance: { increment: kobo } },
      });
      if (moved.count !== 1) throw new AdminError("CANT_ADJUST", kobo < 0 ? "The balance is too low for that debit" : "Wallet not found", 409);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: id } });
      await tx.transaction.create({ data: { walletId: wallet.id, type: "ADJUSTMENT", amount: kobo, balanceBefore: wallet.balance - kobo, balanceAfter: wallet.balance, reference: `admin:${req.userId}`, status: "COMPLETED" } });
      await audit(tx, req, "BALANCE_ADJUST", "USER", id, { amount: body.amount, reason: body.reason, balanceAfter: toNaira(wallet.balance) });
      return wallet.balance;
    });
    res.json({ ok: true, balance: toNaira(balance) });
  } catch (err) { fail(res, err); }
});

// Delete an account the same way a player deletes their own: personal details erased, login
// blocked for good; bets and the money ledger are kept (an operator must keep them). The phone
// number and email become free to sign up again. With real money, the wallet must be empty and
// no bets open first.
router.post("/users/:id/delete", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ reason, confirm: z.literal("DELETE", { message: "Type DELETE to confirm" }) }).parse(req.body);
    const id = String(req.params.id);
    if (id === req.userId) throw new AdminError("SELF", "You can't delete your own account here");
    const u = await prisma.user.findUnique({ where: { id }, include: { wallet: true } });
    if (!u) throw new AdminError("NOT_FOUND", "User not found", 404);
    if (u.deletedAt) throw new AdminError("NO_CHANGE", "This account is already deleted", 409);
    if (u.role === "ADMIN") throw new AdminError("IS_ADMIN", "Remove their admin access first", 409);
    const balance = u.wallet?.balance ?? 0;
    const open = await prisma.bet.count({ where: { userId: id, status: "PENDING" } });
    if (!SIMULATE && balance > 0) throw new AdminError("BALANCE_NOT_EMPTY", `Their balance is ${toNaira(balance).toFixed(2)}: pay it out or adjust it to zero first`, 409);
    if (!SIMULATE && open) throw new AdminError("OPEN_BETS", `They have ${open} open bet(s): settle or void them first`, 409);
    await prisma.$transaction(async (tx) => {
      const { retainUntil } = await closeAccount(tx, id, { kind: "ADMIN", adminId: req.userId! }, body.reason);
      await audit(tx, req, "USER_DELETE", "USER", id, { reason: body.reason, balance: toNaira(balance), openBets: open, archivedUntil: retainUntil.toISOString().slice(0, 10) });
    }, { timeout: 20_000 });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

router.post("/users/:id/role", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ role: z.enum(["USER", "ADMIN"]), reason }).parse(req.body);
    const id = String(req.params.id);
    if (id === req.userId) throw new AdminError("SELF", "You can't change your own role");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { role: body.role } });
      await audit(tx, req, body.role === "ADMIN" ? "ROLE_GRANT" : "ROLE_REVOKE", "USER", id, { role: body.role, reason: body.reason });
    });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ---------- bets ----------
type BetWithCount = Prisma.BetGetPayload<{ include: { _count: { select: { selections: true } } } }>;
function betRowDto(b: BetWithCount & { user?: { displayName: string; phone: string | null } }) {
  return {
    id: b.id, ticket: b.ticket, type: b.type, status: b.status, stake: toNaira(b.stake), totalOdds: b.totalOdds,
    potentialPayout: toNaira(b.potentialPayout), payout: b.payout == null ? null : toNaira(b.payout), source: b.source,
    selections: b._count.selections, createdAt: b.createdAt, settledAt: b.settledAt,
    ...(b.user ? { user: { name: b.user.displayName, phone: b.user.phone ? formatNgPhone(b.user.phone) : null }, userId: b.userId } : {}),
  };
}

router.get("/bets", async (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 80);
  const status = String(req.query.status ?? "");
  const where: Prisma.BetWhereInput = {
    ...(["PENDING", "WON", "LOST", "VOID"].includes(status) ? { status } : {}),
    ...(q ? { OR: [{ ticket: normaliseCode(q) }, { id: q }, { userId: q }, { user: userSearch(q) }] } : {}),
  };
  const p = page(req.query.page);
  const [total, bets] = await Promise.all([
    prisma.bet.count({ where }),
    prisma.bet.findMany({ where, orderBy: { createdAt: "desc" }, skip: p * PAGE, take: PAGE, include: { _count: { select: { selections: true } }, user: { select: { displayName: true, phone: true } } } }),
  ]);
  res.json({ total, page: p, pageSize: PAGE, bets: bets.map(betRowDto) });
});

router.get("/bets/:id", async (req, res) => {
  const id = String(req.params.id);
  const b = await prisma.bet.findFirst({
    where: { OR: [{ id }, { ticket: normaliseCode(id) }] },
    include: { selections: true, _count: { select: { selections: true } }, user: { select: { displayName: true, phone: true } } },
  });
  if (!b) return res.status(404).json({ error: "Bet not found", code: "NOT_FOUND" });
  const log = await prisma.auditLog.findMany({ where: { targetType: "BET", targetId: b.id }, orderBy: { createdAt: "desc" } });
  res.json({
    ...betRowDto(b),
    legs: b.selections.map((s) => ({ id: s.id, matchId: s.matchId, home: s.home, away: s.away, league: s.league, kickoff: s.kickoff, market: s.marketLabel || s.market, selection: s.selection, odds: s.oddsAtPlacement, result: s.result })),
    audit: await named(log),
  });
});

// Set pending legs of a bet, then settle it with the normal rules (payout, refund…).
async function setLegs(req: AuthedRequest, betId: string, where: Prisma.BetSelectionWhereInput, result: string, action: string, details: Prisma.InputJsonObject) {
  await prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({ where: { id: betId }, select: { status: true } });
    if (!bet) throw new AdminError("NOT_FOUND", "Bet not found", 404);
    if (bet.status !== "PENDING") throw new AdminError("SETTLED", "This bet is already settled", 409);
    const r = await tx.betSelection.updateMany({ where: { betId, ...where }, data: { result, settledAt: new Date() } });
    if (!r.count) throw new AdminError("NO_CHANGE", "Nothing to change on this bet", 409);
    await audit(tx, req, action, "BET", betId, { ...details, legs: r.count });
  });
  await settleBet(betId);
  return prisma.bet.findUniqueOrThrow({ where: { id: betId }, select: { status: true, payout: true } });
}

// Void the whole bet: every leg void, stake back.
router.post("/bets/:id/void", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const r = await setLegs(req, String(req.params.id), {}, "VOID", "BET_VOID", { reason: why });
    res.json({ ok: true, status: r.status, payout: r.payout == null ? null : toNaira(r.payout) });
  } catch (err) { fail(res, err); }
});

// Settle the pending legs as won or lost.
router.post("/bets/:id/settle", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ result: z.enum(["WON", "LOST"]), reason }).parse(req.body);
    const r = await setLegs(req, String(req.params.id), { result: "PENDING" }, body.result, "BET_SETTLE", { result: body.result, reason: body.reason });
    res.json({ ok: true, status: r.status, payout: r.payout == null ? null : toNaira(r.payout) });
  } catch (err) { fail(res, err); }
});

// One leg: won / lost / void.
router.post("/bets/:id/legs/:legId", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ result: z.enum(["WON", "LOST", "VOID"]), reason }).parse(req.body);
    const legId = String(req.params.legId);
    const r = await setLegs(req, String(req.params.id), { id: legId, result: "PENDING" }, body.result, "LEG_SETTLE", { leg: legId, result: body.result, reason: body.reason });
    res.json({ ok: true, status: r.status, payout: r.payout == null ? null : toNaira(r.payout) });
  } catch (err) { fail(res, err); }
});

// ---------- matches ----------
// The board (live + upcoming) with what's riding on each match, plus finished matches that
// still have pending bets (so they can be settled by hand).
router.get("/matches", async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim().toLowerCase();
    const [board, suspended, pending] = await Promise.all([
      currentMatches().catch(() => []),
      prisma.suspendedMatch.findMany(),
      prisma.betSelection.findMany({ where: { result: "PENDING", matchId: { not: "" } }, select: { matchId: true, home: true, away: true, league: true, country: true, kickoff: true, bet: { select: { stake: true, potentialPayout: true } } } }),
    ]);
    const exposure = new Map<string, { legs: number; stake: number; liability: number; info: typeof pending[number] }>();
    for (const s of pending) {
      const e = exposure.get(s.matchId) ?? { legs: 0, stake: 0, liability: 0, info: s };
      e.legs++; e.stake += s.bet.stake; e.liability += s.bet.potentialPayout;
      exposure.set(s.matchId, e);
    }
    const susp = new Map(suspended.map((s) => [s.matchId, s]));
    const rows = board.map((m) => ({
      matchId: m.matchId, home: m.home, away: m.away, league: m.league, country: m.country, kickoff: m.kickoff, state: m.state as string,
      odds1x2: susp.has(m.matchId) ? null : m.prices["1x2"] ?? null,
    }));
    const onBoard = new Set(rows.map((r) => r.matchId));
    for (const [id, e] of exposure) {
      if (!onBoard.has(id)) rows.push({ matchId: id, home: e.info.home, away: e.info.away, league: e.info.league, country: e.info.country, kickoff: e.info.kickoff ?? new Date(0), state: "off-board", odds1x2: null });
    }
    const out = rows
      .filter((r) => !q || `${r.home} ${r.away} ${r.league} ${r.country} ${r.matchId}`.toLowerCase().includes(q))
      .map((r) => {
        const e = exposure.get(r.matchId);
        const s = susp.get(r.matchId);
        return { ...r, pendingLegs: e?.legs ?? 0, stake: toNaira(e?.stake ?? 0), liability: toNaira(e?.liability ?? 0), suspended: s ? { reason: s.reason, at: s.createdAt } : null };
      })
      .sort((a, b) => b.liability - a.liability || +new Date(a.kickoff) - +new Date(b.kickoff));
    res.json({ total: out.length, matches: out.slice(0, 200) });
  } catch (err) { fail(res, err); }
});

router.post("/matches/:matchId/suspend", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ reason, home: z.string().max(80).default(""), away: z.string().max(80).default(""), league: z.string().max(80).default("") }).parse(req.body);
    const matchId = String(req.params.matchId).slice(0, 80);
    await prisma.$transaction(async (tx) => {
      await tx.suspendedMatch.upsert({ where: { matchId }, create: { matchId, home: body.home, away: body.away, league: body.league, reason: body.reason, createdBy: req.userId! }, update: { reason: body.reason } });
      await audit(tx, req, "MATCH_SUSPEND", "MATCH", matchId, { reason: body.reason, match: `${body.home} vs ${body.away}` });
    });
    forgetSuspensions();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

router.post("/matches/:matchId/unsuspend", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const matchId = String(req.params.matchId);
    await prisma.$transaction(async (tx) => {
      const r = await tx.suspendedMatch.deleteMany({ where: { matchId } });
      if (!r.count) throw new AdminError("NO_CHANGE", "This match isn't suspended", 409);
      await audit(tx, req, "MATCH_UNSUSPEND", "MATCH", matchId, { reason: why });
    });
    forgetSuspensions();
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// Pending legs on a match: void them all, or grade them from a final score; then settle bets.
async function settleMatchLegs(req: AuthedRequest, matchId: string, grade: (leg: { market: string; selection: string }) => string | null, action: string, details: Prisma.InputJsonObject) {
  const legs = await prisma.betSelection.findMany({ where: { matchId, result: "PENDING" }, select: { id: true, betId: true, market: true, selection: true } });
  if (!legs.length) throw new AdminError("NO_CHANGE", "No pending bets on this match", 409);
  const byResult = new Map<string, string[]>();
  let skipped = 0;
  for (const l of legs) {
    const g = grade(l);
    if (!g) { skipped++; continue; }
    byResult.set(g, [...(byResult.get(g) ?? []), l.id]);
  }
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const [result, ids] of byResult) changed += (await tx.betSelection.updateMany({ where: { id: { in: ids }, result: "PENDING" }, data: { result, settledAt: new Date() } })).count;
    await audit(tx, req, action, "MATCH", matchId, { ...details, legs: changed, skipped });
  });
  let settled = 0;
  for (const betId of new Set(legs.map((l) => l.betId))) if (await settleBet(betId)) settled++;
  return { legs: changed, skipped, betsSettled: settled };
}

router.post("/matches/:matchId/void", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const matchId = String(req.params.matchId);
    const out = await settleMatchLegs(req, matchId, () => "VOID", "MATCH_VOID", { reason: why });
    await recordResult(matchId, { status: "VOID" });
    res.json({ ok: true, ...out });
  } catch (err) { fail(res, err); }
});

router.post("/matches/:matchId/result", async (req: AuthedRequest, res) => {
  try {
    const goals = z.number().int().min(0).max(50);
    const body = z.object({ home: goals, away: goals, htHome: goals.nullable().default(null), htAway: goals.nullable().default(null), reason }).parse(req.body);
    const score = { home: body.home, away: body.away, htHome: body.htHome, htAway: body.htAway };
    await recordResult(String(req.params.matchId), { status: "FINISHED", score });
    const out = await settleMatchLegs(req, String(req.params.matchId), (l) => gradeSelection(l.market, l.selection, score), "MATCH_RESULT", { score: `${body.home}-${body.away}${body.htHome != null ? ` (HT ${body.htHome}-${body.htAway})` : ""}`, reason: body.reason });
    res.json({ ok: true, ...out });
  } catch (err) { fail(res, err); }
});

// ---------- reports (the v_* views in the database) ----------
// Postgres numbers come back as BigInt / Decimal and dates as Date: turn them into plain JSON.
const plain = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k,
  typeof v === "bigint" ? Number(v)
  : v instanceof Prisma.Decimal ? Number(v.toString())
  : v instanceof Date ? (k === "day" ? v.toISOString().slice(0, 10) : v.toISOString())
  : v])));

router.get("/reports/daily", async (req, res) => {
  try {
    const days = Math.min(366, Math.max(1, Number(req.query.days) || 30));
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM v_daily_kpis WHERE day > ((now() AT TIME ZONE 'UTC') + interval '1 hour')::date - ${days}::int ORDER BY day`;
    res.json({ days, rows: plain(rows) });
  } catch (err) { fail(res, err); }
});

router.get("/reports/leagues", async (_req, res) => {
  try { res.json({ rows: plain(await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM v_ggr_by_league ORDER BY stake_ngn DESC`) }); }
  catch (err) { fail(res, err); }
});

router.get("/reports/markets", async (_req, res) => {
  try { res.json({ rows: plain(await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM v_ggr_by_market ORDER BY stake_ngn DESC`) }); }
  catch (err) { fail(res, err); }
});

// Dashboard charts: how the bets placed (and players who joined) in the last N Lagos days split up.
// League / market stake splits a multiple's stake evenly across its legs, as the report views do.
router.get("/reports/breakdown", async (req, res) => {
  try {
    const days = Math.min(366, Math.max(1, Number(req.query.days) || 30));
    const since = lagosDayStart(days - 1);
    const byLeg = (col: Prisma.Sql) => prisma.$queryRaw<Record<string, unknown>[]>`
      WITH b AS (SELECT id, stake, (SELECT count(*) FROM bet_legs WHERE bet_id = bets.id) AS n FROM bets WHERE placed_at >= ${since})
      SELECT coalesce(${col}, 'Unknown') AS name, count(DISTINCT b.id) AS bets, round(sum(b.stake::numeric / greatest(b.n, 1)) / 100, 2) AS stake_ngn
      FROM v_bet_legs v JOIN b ON b.id = v.bet_id GROUP BY 1 ORDER BY 3 DESC`;
    const [outcomes, types, leagues, markets, sources] = await Promise.all([
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT status AS name, count(*) AS bets, round(sum(stake) / 100.0, 2) AS stake_ngn FROM bets WHERE placed_at >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT type AS name, count(*) AS bets, round(sum(stake) / 100.0, 2) AS stake_ngn FROM bets WHERE placed_at >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
      byLeg(Prisma.sql`v.league`),
      byLeg(Prisma.sql`v.market_label`),
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT coalesce(nullif(signup_source, ''), 'direct') AS name, count(*) AS players FROM users WHERE created_at >= ${since} GROUP BY 1 ORDER BY 2 DESC`,
    ]);
    res.json({ days, outcomes: plain(outcomes), types: plain(types), leagues: plain(leagues), markets: plain(markets), sources: plain(sources) });
  } catch (err) { fail(res, err); }
});

router.get("/reports/players", async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 50));
    res.json({ rows: plain(await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM v_player_value WHERE bets > 0 ORDER BY stake_ngn DESC LIMIT ${limit}`) });
  } catch (err) { fail(res, err); }
});

// ---------- match chat moderation ----------
// Latest messages (all matches, or one), newest first, with who wrote them.
router.get("/chat", async (req, res) => {
  const p = page(req.query.page);
  const matchId = req.query.matchId ? String(req.query.matchId) : undefined;
  const where: Prisma.ChatMessageWhereInput = matchId ? { matchId } : {};
  const [total, rows] = await Promise.all([
    prisma.chatMessage.count({ where }),
    prisma.chatMessage.findMany({
      where, orderBy: { createdAt: "desc" }, skip: p * PAGE, take: PAGE,
      include: { user: { select: { id: true, customerNo: true, displayName: true, firstName: true, lastName: true, chatMutedUntil: true } } },
    }),
  ]);
  res.json({
    total, page: p, pageSize: PAGE,
    messages: rows.map((m) => ({
      id: m.id, matchId: m.matchId, text: m.text, at: m.createdAt, deleted: !!m.deletedAt,
      user: { id: m.user.id, customerNo: m.user.customerNo, name: [m.user.firstName, m.user.lastName].filter(Boolean).join(" ") || m.user.displayName, mutedUntil: m.user.chatMutedUntil },
    })),
  });
});

router.post("/chat/:id/delete", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const id = String(req.params.id);
    await prisma.$transaction(async (tx) => {
      const m = await tx.chatMessage.findUnique({ where: { id } });
      if (!m) throw new AdminError("NOT_FOUND", "Message not found", 404);
      if (m.deletedAt) throw new AdminError("NO_CHANGE", "Already deleted", 409);
      await tx.chatMessage.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: req.userId } });
      await audit(tx, req, "CHAT_DELETE", "USER", m.userId, { reason: why, matchId: m.matchId, text: m.text });
    });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

router.post("/users/:id/mute", async (req: AuthedRequest, res) => {
  try {
    const body = z.object({ hours: z.coerce.number().int().min(1).max(24 * 365), reason }).parse(req.body);
    const id = String(req.params.id);
    const until = new Date(Date.now() + body.hours * 3_600_000);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { chatMutedUntil: until } });
      await audit(tx, req, "CHAT_MUTE", "USER", id, { hours: body.hours, until: until.toISOString(), reason: body.reason });
    });
    res.json({ ok: true, until });
  } catch (err) { fail(res, err); }
});

router.post("/users/:id/unmute", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const id = String(req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { chatMutedUntil: null } });
      await audit(tx, req, "CHAT_UNMUTE", "USER", id, { reason: why });
    });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ---------- error alerts ----------
// "Send test alert" in the office: a deliberate error, to check the alerts arrive (email / app).
router.post("/test-alert", async (_req, res) => {
  const on = !!process.env.SENTRY_DSN;
  const { Sentry } = await import("../instrument");
  const id = Sentry.captureException(new Error(`Test alert from the Poccabet office (${new Date().toISOString()})`));
  await Sentry.flush(3000);
  res.json({ ok: on, id: on ? id : null, message: on ? "Test alert sent. It should reach you within a minute." : "Error alerts are off: SENTRY_DSN isn't set on the server." });
});

// ---------- withdrawals ----------
// Requests to review (pending first), with who's asking and whether the bank name matches them.
router.get("/withdrawals", async (req, res) => {
  const p = page(req.query.page);
  const status = String(req.query.status || "open"); // empty = the "Open" tab
  const where: Prisma.WithdrawalWhereInput = status === "open" ? { status: { in: OPEN_WITHDRAWAL } } : status === "all" ? {} : { status };
  const [total, rows, waiting] = await Promise.all([
    prisma.withdrawal.count({ where }),
    prisma.withdrawal.findMany({
      where, orderBy: status === "open" ? { createdAt: "asc" } : { createdAt: "desc" }, skip: p * PAGE, take: PAGE,
      include: { user: { select: { id: true, customerNo: true, displayName: true, firstName: true, lastName: true, wallet: { select: { id: true } } } } },
    }),
    prisma.withdrawal.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  // What each player has paid in and taken out (completed only), to judge a request.
  const walletIds = rows.map((r) => r.user.wallet?.id).filter((x): x is string => !!x);
  const sums = walletIds.length ? await prisma.transaction.groupBy({ by: ["walletId", "type"], where: { walletId: { in: walletIds }, type: { in: ["DEPOSIT", "WITHDRAWAL"] }, status: "COMPLETED" }, _sum: { amount: true } }) : [];
  const sum = (walletId: string | undefined, type: string) => Math.abs(sums.find((x) => x.walletId === walletId && x.type === type)?._sum.amount ?? 0);
  const reviewers = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.reviewedBy).filter((x): x is string => !!x) } }, select: { id: true, displayName: true } });
  res.json({
    total, page: p, pageSize: PAGE,
    waiting: { count: waiting._count._all, amount: toNaira(waiting._sum.amount ?? 0) },
    withdrawals: rows.map((w) => ({
      id: w.id, amount: toNaira(w.amount), status: w.status, reference: w.reference, note: w.note,
      bankName: w.bankName, accountNumber: w.accountNumber, accountName: w.accountName,
      createdAt: w.createdAt, reviewedAt: w.reviewedAt, reviewedBy: reviewers.find((r) => r.id === w.reviewedBy)?.displayName ?? null,
      user: { id: w.user.id, customerNo: w.user.customerNo, name: [w.user.firstName, w.user.lastName].filter(Boolean).join(" ") || w.user.displayName },
      nameMatch: nameMatches(w.accountName, w.user.firstName, w.user.lastName),
      deposited: toNaira(sum(w.user.wallet?.id, "DEPOSIT")), withdrawn: toNaira(sum(w.user.wallet?.id, "WITHDRAWAL")),
    })),
  });
});

const wFail = (res: Response, err: unknown) => (err instanceof WithdrawalError ? res.status(err.status).json({ error: err.message, code: err.code }) : fail(res, err));

router.post("/withdrawals/:id/approve", async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id);
    const w0 = await prisma.withdrawal.findUnique({ where: { id }, select: { userId: true } });
    if (!w0) throw new AdminError("NOT_FOUND", "Withdrawal not found", 404);
    if (w0.userId === req.userId) throw new AdminError("OWN_WITHDRAWAL", "Another admin has to approve your own withdrawal", 403);
    const w = await approveWithdrawal(id, req.userId!, (tx, row) => audit(tx, req, "WITHDRAWAL_APPROVE", "USER", row.userId, { reference: row.reference, amount: toNaira(row.amount), bank: row.bankName, account: row.accountNumber }));
    res.json({ ok: true, status: w.status, note: w.note });
  } catch (err) { wFail(res, err); }
});

router.post("/withdrawals/:id/reject", async (req: AuthedRequest, res) => {
  try {
    const why = reason.parse(req.body?.reason);
    const w = await rejectWithdrawal(String(req.params.id), req.userId!, why, (tx, row) => audit(tx, req, "WITHDRAWAL_REJECT", "USER", row.userId, { reference: row.reference, amount: toNaira(row.amount), reason: why }));
    res.json({ ok: true, status: w.status });
  } catch (err) { wFail(res, err); }
});

// Ask Paystack about a payout that's still on its way.
router.post("/withdrawals/:id/check", async (req: AuthedRequest, res) => {
  try {
    if (!(await prisma.withdrawal.findUnique({ where: { id: String(req.params.id) }, select: { id: true } }))) throw new AdminError("NOT_FOUND", "Withdrawal not found", 404);
    const w = await checkWithdrawal(String(req.params.id));
    res.json({ ok: true, status: w.status, note: w.note });
  } catch (err) { wFail(res, err); }
});

// ---------- audit log ----------
router.get("/audit", async (req, res) => {
  const p = page(req.query.page);
  const where: Prisma.AuditLogWhereInput = {
    ...(req.query.targetType ? { targetType: String(req.query.targetType) } : {}),
    ...(req.query.targetId ? { targetId: String(req.query.targetId) } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: p * PAGE, take: PAGE }),
  ]);
  res.json({ total, page: p, pageSize: PAGE, entries: await named(rows) });
});

export default router;
