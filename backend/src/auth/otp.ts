// One-time codes by SMS: start (send a code) and verify (swap a right code for a short-lived
// verification token that the next step — e.g. creating the account — must present).
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { smsSender } from "../lib/sms";

export type OtpPurpose = "SIGNUP";

export const OTP_RULES = {
  length: 6,
  ttlMs: 5 * 60_000, // a code works for 5 minutes
  maxAttempts: 5, // wrong guesses allowed per code
  resendAfterMs: 60_000, // one code per minute per number
  maxPerHour: 5, // codes per number per hour
  tokenTtl: "15m", // time to finish sign-up after verifying
};

export class OtpError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: Record<string, unknown>) {
    super(message);
  }
}

const secret = () => process.env.JWT_SECRET!;
const hashCode = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}:${secret()}`).digest("hex");

export async function startOtp(phone: string, purpose: OtpPurpose, now = Date.now()) {
  const sender = smsSender();
  if (!sender) throw new OtpError("SMS_UNAVAILABLE", "We can't send codes right now. Please try again later.", 503);

  const recent = await prisma.otpCode.findMany({
    where: { phone, purpose, createdAt: { gte: new Date(now - 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  const waitMs = recent[0] ? recent[0].createdAt.getTime() + OTP_RULES.resendAfterMs - now : 0;
  if (waitMs > 0) {
    throw new OtpError("TOO_SOON", `Please wait ${Math.ceil(waitMs / 1000)}s before asking for another code.`, 429, { retryIn: Math.ceil(waitMs / 1000) });
  }
  if (recent.length >= OTP_RULES.maxPerHour) {
    throw new OtpError("TOO_MANY_CODES", "Too many codes requested for this number. Try again in an hour.", 429);
  }

  const code = String(randomInt(0, 10 ** OTP_RULES.length)).padStart(OTP_RULES.length, "0");
  await prisma.otpCode.create({
    data: { phone, purpose, codeHash: hashCode(phone, code), expiresAt: new Date(now + OTP_RULES.ttlMs) },
  });
  await sender.send(phone, `Your Poccabet code is ${code}. It expires in 5 minutes. Never share it with anyone.`);
  return {
    resendIn: OTP_RULES.resendAfterMs / 1000,
    expiresIn: OTP_RULES.ttlMs / 1000,
    ...(sender.demo ? { demoCode: code } : {}), // demo only: nothing was really sent
  };
}

export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string, now = Date.now()) {
  const latest = await prisma.otpCode.findFirst({ where: { phone, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!latest || latest.expiresAt.getTime() < now) throw new OtpError("CODE_EXPIRED", "That code has expired. Request a new one.");
  if (latest.attempts >= OTP_RULES.maxAttempts) throw new OtpError("TOO_MANY_ATTEMPTS", "Too many wrong tries. Request a new code.", 429);

  // Count the try first (and atomically), so parallel guesses can't get extra attempts.
  const counted = await prisma.otpCode.updateMany({
    where: { id: latest.id, attempts: { lt: OTP_RULES.maxAttempts }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) throw new OtpError("TOO_MANY_ATTEMPTS", "Too many wrong tries. Request a new code.", 429);

  const given = Buffer.from(hashCode(phone, String(code).trim()));
  const right = Buffer.from(latest.codeHash);
  if (given.length !== right.length || !timingSafeEqual(given, right)) {
    const left = OTP_RULES.maxAttempts - latest.attempts - 1;
    throw new OtpError("WRONG_CODE", left > 0 ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong code. Request a new one.", 400, { attemptsLeft: left });
  }

  const used = await prisma.otpCode.updateMany({ where: { id: latest.id, consumedAt: null }, data: { consumedAt: new Date(now) } });
  if (used.count !== 1) throw new OtpError("CODE_EXPIRED", "That code was already used. Request a new one.");
  return jwt.sign({ sub: phone, purpose, typ: "otp" }, secret(), { expiresIn: OTP_RULES.tokenTtl as jwt.SignOptions["expiresIn"] });
}

// The phone number a verification token was issued for (or null if it's invalid / expired / for something else).
export function phoneFromToken(token: string, purpose: OtpPurpose): string | null {
  try {
    const p = jwt.verify(token, secret()) as { sub?: string; purpose?: string; typ?: string };
    return p.typ === "otp" && p.purpose === purpose && p.sub ? p.sub : null;
  } catch {
    return null;
  }
}
