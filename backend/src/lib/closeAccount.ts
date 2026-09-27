// Closing (deleting) an account. The player's identity and a money summary are copied into the
// sealed closed_accounts archive, then the users row is anonymised and login is blocked. Bets and
// the wallet ledger stay linked to the user id, so full statements can still be produced.
// Legal / AML record keeping: the archive is kept for RETENTION_YEARS after closure, then purged.
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const RETENTION_YEARS = Math.max(1, Number(process.env.ACCOUNT_RETENTION_YEARS) || 5);

type Tx = Prisma.TransactionClient;

export async function closeAccount(tx: Tx, userId: string, by: { kind: "PLAYER" } | { kind: "ADMIN"; adminId: string }, reason: string | null) {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: { wallet: true } });
  const closedAt = new Date();
  const retainUntil = new Date(closedAt);
  retainUntil.setFullYear(retainUntil.getFullYear() + RETENTION_YEARS);

  const walletId = u.wallet?.id ?? "";
  const sumOf = async (type: string) =>
    Math.abs((await tx.transaction.aggregate({ where: { walletId, type, status: "COMPLETED" }, _sum: { amount: true } }))._sum.amount ?? 0);
  const [deposits, withdrawals, bonuses, betTotals, openBets, firstBet, lastBet, lastLogin, signup] = await Promise.all([
    sumOf("DEPOSIT"), sumOf("WITHDRAWAL"), sumOf("BONUS"),
    tx.bet.aggregate({ where: { userId }, _sum: { stake: true, payout: true }, _count: { _all: true } }),
    tx.bet.count({ where: { userId, status: "PENDING" } }),
    tx.bet.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    tx.bet.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    tx.loginEvent.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    tx.loginEvent.findFirst({ where: { userId, method: "SIGNUP" }, orderBy: { createdAt: "asc" } }),
  ]);

  await tx.closedAccount.create({
    data: {
      userId, closedAt, retainUntil, reason,
      closedBy: by.kind, closedByAdmin: by.kind === "ADMIN" ? by.adminId : null,
      displayName: u.displayName, firstName: u.firstName, lastName: u.lastName, dateOfBirth: u.dateOfBirth,
      phone: u.phone, phoneVerifiedAt: u.phoneVerifiedAt, email: u.email, emailVerifiedAt: u.emailVerifiedAt,
      ageConfirmedAt: u.ageConfirmedAt, referralCode: u.referralCode, signupSource: u.signupSource,
      registeredAt: u.createdAt, suspendedAt: u.suspendedAt, suspendedReason: u.suspendedReason,
      lastLoginAt: u.lastLoginAt ?? lastLogin?.createdAt ?? null, lastLoginIp: lastLogin?.ip ?? null,
      lastUserAgent: lastLogin?.userAgent ?? null, signupIp: signup?.ip ?? null,
      balance: u.wallet?.balance ?? 0, deposits, withdrawals, bonuses,
      staked: betTotals._sum.stake ?? 0, paidOut: betTotals._sum.payout ?? 0, bets: betTotals._count._all, openBets,
      firstBetAt: firstBet?.createdAt ?? null, lastBetAt: lastBet?.createdAt ?? null,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: {
      deletedAt: closedAt, passwordChangedAt: closedAt,
      email: null, emailVerifiedAt: null, phone: null, phoneVerifiedAt: null,
      firstName: null, lastName: null, dateOfBirth: null, referralCode: null,
      displayName: "Deleted user", role: "USER",
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10), // nobody can log in again
    },
  });
  return { closedAt, retainUntil };
}

// Deletes archive records whose retention period is over. Run daily.
export async function purgeExpiredArchives() {
  const { count } = await prisma.closedAccount.deleteMany({ where: { retainUntil: { lt: new Date() } } });
  if (count) console.log(`closed-account archive: purged ${count} record(s) past retention`);
  return count;
}
