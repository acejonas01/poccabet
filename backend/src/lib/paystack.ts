// Paystack (card / bank / USSD payments). Test mode until live keys are set: PAYSTACK_SECRET_KEY
// starting sk_test_ moves no real money. The secret key never leaves the server; players pay on
// Paystack's own page and we only credit a wallet after asking Paystack whether the payment went
// through (or when Paystack's signed webhook says so).
import crypto from "crypto";

// PAYSTACK_BASE_URL can point at a fake Paystack for local tests.
const BASE = () => process.env.PAYSTACK_BASE_URL || "https://api.paystack.co";
const secret = () => process.env.PAYSTACK_SECRET_KEY || "";

export const paystackReady = () => !!secret();
export const paystackTestMode = () => secret().startsWith("sk_test_");
// Real money may only move when the wallets hold real money: while the site runs on play money
// (simulation), only a Paystack TEST key is allowed — a live key would turn play money into naira.
export const paymentsAllowed = (simulate: boolean) => paystackReady() && (paystackTestMode() || !simulate);

// Paystack answered and said no (bad account, not enough balance…) — as opposed to a network
// error or timeout, where we can't know whether the request went through.
export class PaystackError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !body.status) throw new PaystackError(body.message || `Paystack ${path}: ${res.status}`);
  return body.data as T;
}

// Start a payment: returns the Paystack page the player is sent to.
export function initializePayment(p: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, unknown> }) {
  return call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({ email: p.email, amount: p.amountKobo, currency: "NGN", reference: p.reference, callback_url: p.callbackUrl, metadata: p.metadata }),
  });
}

// What Paystack says happened to a payment: status "success" | "failed" | "abandoned" | "ongoing" | ….
export function verifyPayment(reference: string) {
  return call<{ status: string; amount: number; currency: string; reference: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Webhooks are signed: HMAC-SHA512 of the raw body with the secret key, in x-paystack-signature.
export function validWebhookSignature(raw: Buffer, signature: string | undefined) {
  if (!signature || !secret()) return false;
  const expected = crypto.createHmac("sha512", secret()).update(raw).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- payouts (withdrawals) ----------
let banksCache: { at: number; list: { name: string; code: string }[] } | null = null;
// Nigerian banks that can receive transfers (cached for a day).
export async function listBanks() {
  if (banksCache && Date.now() - banksCache.at < 86_400_000) return banksCache.list;
  const rows = await call<{ name: string; code: string; active?: boolean; is_deleted?: boolean }[]>("/bank?country=nigeria&currency=NGN&perPage=200");
  const list = rows.filter((b) => b.active !== false && !b.is_deleted).map((b) => ({ name: b.name, code: b.code })).sort((a, b) => a.name.localeCompare(b.name));
  banksCache = { at: Date.now(), list };
  return list;
}

// The name on a bank account, from the bank itself.
export function resolveAccount(accountNumber: string, bankCode: string) {
  return call<{ account_name: string; account_number: string }>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
}

export function createRecipient(p: { name: string; accountNumber: string; bankCode: string }) {
  return call<{ recipient_code: string }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({ type: "nuban", name: p.name, account_number: p.accountNumber, bank_code: p.bankCode, currency: "NGN" }),
  });
}

// Send money from the Paystack balance. status: "success" | "pending" | "otp" (OTP for transfers
// is switched on in the Paystack dashboard — turn it off there so payouts can go out) | "failed".
export function sendTransfer(p: { amountKobo: number; recipientCode: string; reference: string; reason: string }) {
  return call<{ transfer_code: string; status: string; reference: string }>("/transfer", {
    method: "POST",
    body: JSON.stringify({ source: "balance", amount: p.amountKobo, recipient: p.recipientCode, reference: p.reference, reason: p.reason, currency: "NGN" }),
  });
}

export function verifyTransfer(reference: string) {
  return call<{ status: string; amount: number; reference: string; transfer_code: string }>(`/transfer/verify/${encodeURIComponent(reference)}`);
}
