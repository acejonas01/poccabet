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

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !body.status) throw new Error(`Paystack ${path}: ${res.status} ${body.message ?? ""}`.trim());
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
