// Rate limits: how many requests a caller (an IP, a phone number, an account…) may make in a
// time window. Kept in memory — fine for one server; with several servers, move the counts to
// a shared store (e.g. Redis) behind this same function.
import type { NextFunction, Request, Response } from "express";
import type { AuthedRequest } from "../middleware/auth";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Drop expired counters every minute so memory stays small.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref();

// The caller's IP. Both sites reach the API through Vercel, which passes the visitor's IP first
// in X-Forwarded-For. It can be faked by calling the API directly, so limits that protect
// accounts and SMS money are also keyed on the phone number / email / account (see below).
export function clientIp(req: Request) {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "unknown";
}

// Count one hit for `key` in the named limit; true when it's over the limit.
export function hit(name: string, key: string, max: number, windowMs: number) {
  const id = `${name}:${key}`;
  const now = Date.now();
  let b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(id, b);
  }
  b.count++;
  return { over: b.count > max, retryIn: Math.ceil((b.resetAt - now) / 1000) };
}

// How many hits `key` has in the named limit right now (without counting one).
export function peek(name: string, key: string) {
  const b = buckets.get(`${name}:${key}`);
  return b && b.resetAt > Date.now() ? b.count : 0;
}

const OFF = process.env.RATE_LIMITS === "off"; // e.g. for load tests; never in production

type KeyFn = (req: AuthedRequest) => string | null | undefined;
export const byIp: KeyFn = (req) => clientIp(req);
export const byUser: KeyFn = (req) => req.userId;
export const everyone: KeyFn = () => "all";

// Middleware: `max` requests per `minutes` for each key (requests without a key pass).
export function limit(name: string, max: number, minutes: number, key: KeyFn = byIp) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (OFF) return next();
    const k = key(req);
    if (!k) return next();
    const { over, retryIn } = hit(name, k, max, minutes * 60_000);
    if (!over) return next();
    res.setHeader("Retry-After", String(retryIn));
    const wait = retryIn >= 120 ? `${Math.ceil(retryIn / 60)} minutes` : `${retryIn} seconds`;
    res.status(429).json({ error: `Too many attempts. Try again in ${wait}.`, code: "RATE_LIMITED", retryIn });
  };
}
