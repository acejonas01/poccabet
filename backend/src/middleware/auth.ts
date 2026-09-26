import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

// A login session (7 days).
export const signSession = (userId: string) => jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });

export const SUSPENDED_MESSAGE = "Your account is suspended. Please contact support.";

export interface AuthedRequest extends Request {
  userId?: string;
}

// A valid token for an account that still exists (deleted accounts are logged out everywhere).
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  let userId: string;
  let issuedAt = 0;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; iat?: number };
    userId = payload.sub;
    issuedAt = (payload.iat ?? 0) * 1000;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, suspendedAt: true, passwordChangedAt: true } });
    if (!user || user.deletedAt) return res.status(401).json({ error: "This account no longer exists", code: "ACCOUNT_DELETED" });
    if (user.suspendedAt) return res.status(403).json({ error: SUSPENDED_MESSAGE, code: "ACCOUNT_SUSPENDED" });
    // Tokens carry whole seconds: a session made in the same second as the change still counts.
    if (user.passwordChangedAt && issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
      return res.status(401).json({ error: "Your password was changed. Please log in again.", code: "SESSION_EXPIRED" });
    }
  } catch (err) {
    return next(err);
  }
  req.userId = userId;
  next();
}
