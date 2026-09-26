import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

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
  try {
    userId = (jwt.verify(token, process.env.JWT_SECRET!) as { sub: string }).sub;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true, suspendedAt: true } });
    if (!user || user.deletedAt) return res.status(401).json({ error: "This account no longer exists", code: "ACCOUNT_DELETED" });
    if (user.suspendedAt) return res.status(403).json({ error: SUSPENDED_MESSAGE, code: "ACCOUNT_SUSPENDED" });
  } catch (err) {
    return next(err);
  }
  req.userId = userId;
  next();
}
