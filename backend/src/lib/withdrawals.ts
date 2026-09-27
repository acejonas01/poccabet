// Withdrawals. Requesting one takes the amount out of the wallet and holds it (lockedBalance) so
// it can't be bet as well; an admin then approves it (→ Paystack transfer to the player's bank)
// or rejects it (→ money back). Every change checks the status it expects in the same step, so
// a payout can't be approved twice or refunded twice, whatever arrives first (admin, webhook…).
//
// Ledger: a WITHDRAWAL row (−amount) is written when requested — PENDING, then COMPLETED when
// paid or FAILED when it wasn't; money going back is a WITHDRAWAL_REVERSAL row (+amount).
import crypto from "crypto";
import { Prisma, type Withdrawal } from "@prisma/client";
import { prisma } from "./prisma";
import { PaystackError, createRecipient, sendTransfer, verifyTransfer } from "./paystack";

export const MIN_WITHDRAWAL = 1_000; // naira
export const MAX_WITHDRAWAL = 500_000;
export const OPEN = ["PENDING", "PROCESSING"];

export class WithdrawalError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
type Tx = Prisma.TransactionClient;

// Player asks to withdraw `amountKobo` to their saved bank account.
export async function requestWithdrawal(userId: string, amountKobo: number) {
  try {
    return await prisma.$transaction(async (tx) => {
      const bank = await tx.bankAccount.findUnique({ where: { userId } });
      if (!bank) throw new WithdrawalError("NO_BANK_ACCOUNT", "Add your bank account first");
      if (await tx.withdrawal.findFirst({ where: { userId, status: { in: OPEN } }, select: { id: true } }))
        throw new WithdrawalError("ONE_AT_A_TIME", "You already have a withdrawal in progress", 409);
      const debit = await tx.wallet.updateMany({
        where: { userId, balance: { gte: amountKobo } },
        data: { balance: { decrement: amountKobo }, lockedBalance: { increment: amountKobo } },
      });
      if (debit.count !== 1) throw new WithdrawalError("INSUFFICIENT_FUNDS", "Your balance is too low for this withdrawal", 402);
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      const reference = `PBW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const w = await tx.withdrawal.create({
        data: { userId, amount: amountKobo, reference, status: "PENDING", bankCode: bank.bankCode, bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName },
      });
      await tx.transaction.create({
        data: { walletId: wallet.id, type: "WITHDRAWAL", amount: -amountKobo, balanceBefore: wallet.balance + amountKobo, balanceAfter: wallet.balance, reference, status: "PENDING" },
      });
      return { withdrawal: w, balance: wallet.balance };
    });
  } catch (err) {
    // The "one open withdrawal per player" index: two requests at the same moment.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new WithdrawalError("ONE_AT_A_TIME", "You already have a withdrawal in progress", 409);
    throw err;
  }
}

// Money back to the wallet (rejected, cancelled or failed payout). `from` = statuses it may be in.
async function giveBack(tx: Tx, id: string, from: string[], to: string, note: string | null, reviewer?: string) {
  const moved = await tx.withdrawal.updateMany({ where: { id, status: { in: from } }, data: { status: to, note, ...(reviewer ? { reviewedBy: reviewer, reviewedAt: new Date() } : {}) } });
  if (moved.count !== 1) return false;
  const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
  // Still held unless it had already been paid (a bank reversal after payment).
  const held = !from.includes("PAID");
  const wallet = await tx.wallet.update({ where: { userId: w.userId }, data: { balance: { increment: w.amount }, ...(held ? { lockedBalance: { decrement: w.amount } } : {}) } });
  await tx.transaction.updateMany({ where: { type: "WITHDRAWAL", reference: w.reference }, data: { status: "FAILED" } });
  await tx.transaction.create({
    data: { walletId: wallet.id, type: "WITHDRAWAL_REVERSAL", amount: w.amount, balanceBefore: wallet.balance - w.amount, balanceAfter: wallet.balance, reference: w.reference, status: "COMPLETED" },
  });
  return true;
}

// Paid out: the held money has left for good.
async function markPaid(tx: Tx, id: string) {
  const moved = await tx.withdrawal.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "PAID", note: null } });
  if (moved.count !== 1) return false;
  const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
  await tx.wallet.update({ where: { userId: w.userId }, data: { lockedBalance: { decrement: w.amount } } });
  await tx.transaction.updateMany({ where: { type: "WITHDRAWAL", reference: w.reference }, data: { status: "COMPLETED" } });
  return true;
}

export async function cancelWithdrawal(userId: string, id: string) {
  const ok = await prisma.$transaction((tx) => giveBack(tx, id, ["PENDING"], "CANCELLED", "Cancelled by the player"));
  if (!ok) throw new WithdrawalError("CANT_CANCEL", "This withdrawal can no longer be cancelled", 409);
  return prisma.withdrawal.findUniqueOrThrow({ where: { id } });
}

export async function rejectWithdrawal(id: string, adminId: string, note: string, after: (tx: Tx, w: Withdrawal) => Promise<unknown>) {
  return prisma.$transaction(async (tx) => {
    if (!(await giveBack(tx, id, ["PENDING"], "REJECTED", note, adminId))) throw new WithdrawalError("NOT_PENDING", "Only a pending withdrawal can be rejected", 409);
    const w = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
    await after(tx, w);
    return w;
  });
}

// Settle a PROCESSING payout from what Paystack says about the transfer.
async function settle(id: string, status: string, note?: string) {
  if (status === "success") return prisma.$transaction((tx) => markPaid(tx, id));
  if (status === "failed" || status === "reversed" || status === "rejected" || status === "abandoned") {
    return prisma.$transaction((tx) => giveBack(tx, id, ["PROCESSING"], "FAILED", note ?? `Payout ${status} at the bank — money returned to the wallet`));
  }
  return false; // still on its way (pending / received / queued / otp)
}

// Admin approves: claim it (PENDING → PROCESSING) so it can only be approved once, then pay.
export async function approveWithdrawal(id: string, adminId: string, after: (tx: Tx, w: Withdrawal) => Promise<unknown>) {
  const w = await prisma.$transaction(async (tx) => {
    const claimed = await tx.withdrawal.updateMany({ where: { id, status: "PENDING" }, data: { status: "PROCESSING", reviewedBy: adminId, reviewedAt: new Date(), note: null } });
    if (claimed.count !== 1) throw new WithdrawalError("NOT_PENDING", "Only a pending withdrawal can be approved", 409);
    const row = await tx.withdrawal.findUniqueOrThrow({ where: { id } });
    await after(tx, row);
    return row;
  });
  try {
    const recipient = await createRecipient({ name: w.accountName, accountNumber: w.accountNumber, bankCode: w.bankCode });
    const t = await sendTransfer({ amountKobo: w.amount, recipientCode: recipient.recipient_code, reference: w.reference, reason: `Poccabet withdrawal ${w.reference}` });
    await prisma.withdrawal.update({
      where: { id }, data: { transferCode: t.transfer_code, note: t.status === "otp" ? "Paystack is asking for an OTP: turn off OTP for transfers in the Paystack dashboard, then check again" : null },
    });
    await settle(id, t.status);
  } catch (err) {
    if (err instanceof PaystackError) {
      // Paystack said no (e.g. not enough in the Paystack balance): nothing was sent. Back to the
      // queue with the reason; the money stays held for the player.
      await prisma.withdrawal.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "PENDING", note: `Payout not sent: ${err.message}` } });
    } else {
      // Network trouble: we can't tell whether Paystack got it. Leave it PROCESSING; "Check" asks.
      console.error(`withdrawal ${w.reference}: transfer outcome unknown`, err);
      await prisma.withdrawal.update({ where: { id }, data: { note: "Couldn't confirm the payout with Paystack. Use Check status." } });
    }
  }
  return prisma.withdrawal.findUniqueOrThrow({ where: { id } });
}

// "Check status" (admin) — ask Paystack about a payout that's still PROCESSING.
export async function checkWithdrawal(id: string) {
  const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id } });
  if (w.status === "PROCESSING") {
    try {
      const t = await verifyTransfer(w.reference);
      await settle(id, t.status);
    } catch (err) {
      // Paystack has no transfer with this reference: it never went out, so it's safe to retry.
      if (err instanceof PaystackError) await prisma.withdrawal.updateMany({ where: { id, status: "PROCESSING" }, data: { status: "PENDING", note: `Payout not found at Paystack (${err.message}); approve again to retry` } });
      else throw err;
    }
  }
  return prisma.withdrawal.findUniqueOrThrow({ where: { id } });
}

// Paystack's transfer webhooks (transfer.success / transfer.failed / transfer.reversed).
export async function onTransferEvent(reference: string, event: string) {
  const w = await prisma.withdrawal.findUnique({ where: { reference } });
  if (!w) return false;
  const status = event === "transfer.success" ? "success" : event === "transfer.failed" ? "failed" : event === "transfer.reversed" ? "reversed" : null;
  if (!status) return false;
  // A reversal can come after "success": the bank sent it back, so the player gets it back too.
  if (status === "reversed" && w.status === "PAID") {
    return prisma.$transaction((tx) => giveBack(tx, w.id, ["PAID"], "FAILED", "The bank reversed the payout — money returned to the wallet"));
  }
  return settle(w.id, status);
}

// Does the bank account's name look like the player's own name? (null = no name to compare)
export function nameMatches(accountName: string, first: string | null, last: string | null) {
  const words = (s: string) => s.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
  const mine = [...words(first ?? ""), ...words(last ?? "")];
  if (mine.length < 2) return null;
  const theirs = new Set(words(accountName));
  return mine.filter((w) => theirs.has(w)).length >= 2;
}
