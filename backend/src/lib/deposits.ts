// Deposits through Paystack. A deposit is a DEPOSIT ledger row: PENDING when the player is sent to
// Paystack, COMPLETED (wallet credited) once Paystack confirms the payment, FAILED if it didn't go
// through. Both the player's return and Paystack's webhook end up in creditDeposit, which only
// ever credits once, and only the amount that was actually paid.
import { prisma } from "./prisma";
import { verifyPayment } from "./paystack";

export const MIN_DEPOSIT = 100; // naira
export const MAX_DEPOSIT = 1_000_000;

export type DepositResult =
  | { status: "COMPLETED"; amount: number; balance: number | null } // kobo
  | { status: "PENDING" | "FAILED" | "UNKNOWN" };

// Paystack says `reference` was paid `paidKobo` in `currency`: credit the wallet (once).
export async function creditDeposit(reference: string, paidKobo: number, currency: string): Promise<DepositResult> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.transaction.findFirst({ where: { type: "DEPOSIT", reference } });
    if (!row) return { status: "UNKNOWN" as const };
    if (row.status === "COMPLETED") return { status: "COMPLETED" as const, amount: row.amount, balance: row.balanceAfter };
    if (row.status !== "PENDING") return { status: row.status as "FAILED" };
    if (currency !== "NGN" || paidKobo !== row.amount) {
      console.error(`deposit ${reference}: paid ${paidKobo} ${currency}, expected ${row.amount} NGN — not credited`);
      await tx.transaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "FAILED" } });
      return { status: "FAILED" as const };
    }
    // The status check and the change are one step, so two callers can't both credit it.
    const claimed = await tx.transaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "COMPLETED" } });
    if (claimed.count !== 1) {
      const now = await tx.transaction.findUniqueOrThrow({ where: { id: row.id } });
      return now.status === "COMPLETED" ? { status: "COMPLETED" as const, amount: now.amount, balance: now.balanceAfter } : { status: "FAILED" as const };
    }
    const wallet = await tx.wallet.update({ where: { id: row.walletId }, data: { balance: { increment: row.amount } } });
    await tx.transaction.update({ where: { id: row.id }, data: { balanceBefore: wallet.balance - row.amount, balanceAfter: wallet.balance } });
    return { status: "COMPLETED" as const, amount: row.amount, balance: wallet.balance };
  });
}

// Ask Paystack about a deposit and settle it: credited if paid, FAILED if Paystack says it failed,
// still PENDING while the player hasn't finished (or abandoned) the payment.
export async function checkDeposit(reference: string): Promise<DepositResult> {
  const row = await prisma.transaction.findFirst({ where: { type: "DEPOSIT", reference } });
  if (!row) return { status: "UNKNOWN" };
  if (row.status === "COMPLETED") return { status: "COMPLETED", amount: row.amount, balance: row.balanceAfter };
  if (row.status !== "PENDING") return { status: "FAILED" };
  const paid = await verifyPayment(reference);
  if (paid.status === "success") return creditDeposit(reference, paid.amount, paid.currency);
  if (paid.status === "failed" || paid.status === "reversed") {
    await prisma.transaction.updateMany({ where: { id: row.id, status: "PENDING" }, data: { status: "FAILED" } });
    return { status: "FAILED" };
  }
  return { status: "PENDING" };
}
