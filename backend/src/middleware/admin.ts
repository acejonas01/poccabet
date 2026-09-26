// Admin-only endpoints (odds sync, usage). Until the admin panel adds admin accounts, these take
// the ADMIN_API_KEY in an "x-admin-key" header. With no key set on the server they stay closed.
import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { clientIp, hit, peek } from "../lib/rateLimit";

export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY ?? "";
  const given = String(req.headers["x-admin-key"] ?? "");
  // Wrong keys are counted per IP (20 per 15 minutes), so the key can't be guessed by brute force.
  const ip = clientIp(req);
  if (peek("admin-key-fail", ip) >= 20) return res.status(429).json({ error: "Too many attempts", code: "RATE_LIMITED" });
  const ok = expected.length >= 24 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) {
    hit("admin-key-fail", ip, 20, 15 * 60_000);
    return res.status(404).json({ error: "Not found" }); // don't advertise admin routes
  }
  next();
}
