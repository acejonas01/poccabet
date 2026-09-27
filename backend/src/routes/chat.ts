// Live chat on match pages. Everyone can read; logged-in players can post. Kept safe for a betting
// site: short messages, a few seconds between posts, no links or phone numbers (the usual "fixed
// match, WhatsApp me" scams), bad words masked, and admins can delete messages or mute players
// (see routes/admin.ts). Messages are purged after 7 days.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { byUser, hit, limit } from "../lib/rateLimit";

const router = Router();
const MAX_LEN = 200;
const KEEP_DAYS = 7;

const matchId = z.string().trim().regex(/^[a-z]+-\d{1,12}$/i, "Unknown match");

// Links and anything that looks like a phone number or contact handle are refused outright.
const LINK = /(https?:\/\/|www\.|\bt\.me\b|\bwa\.me\b|\b[a-z0-9-]{2,}\.(com|ng|net|org|io|xyz|me|link|app|co|info|bet|live|site|online)\b|@[a-z0-9_]{3,})/i;
const hasPhone = (t: string) => (t.match(/\+?\d[\d\s().-]{6,}\d/g) ?? []).some((m) => m.replace(/\D/g, "").length >= 7);
// Masked, not refused: keep the first letter so the sense survives ("f***").
const BAD = ["fuck", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt", "nigga", "nigger", "motherfucker", "ashawo", "olodo", "werey", "mumu"];
const BAD_RE = new RegExp(`\\b(${BAD.join("|")})\\w*`, "gi");
const clean = (t: string) => t.replace(BAD_RE, (w) => w[0] + "*".repeat(w.length - 1));

// Names are masked before they leave the server ("and***016", "Tu***e"), like other betting sites.
export function maskName(raw: string) {
  const n = raw.replace(/\s+/g, "");
  if (n.length >= 7) return `${n.slice(0, 3)}***${n.slice(-3)}`;
  if (n.length >= 4) return `${n.slice(0, 2)}***${n.slice(-1)}`;
  return `${n.slice(0, 1)}***`;
}
const who = { select: { displayName: true } } as const;
const pick = {
  id: true, text: true, createdAt: true, user: who,
  replyTo: { select: { text: true, deletedAt: true, user: who } },
} as const;
type Row = { id: string; text: string; createdAt: Date; user: { displayName: string }; replyTo: { text: string; deletedAt: Date | null; user: { displayName: string } } | null };
const dto = (m: Row) => ({
  id: m.id, name: maskName(m.user.displayName), text: m.text, at: m.createdAt,
  reply: m.replyTo ? { name: maskName(m.replyTo.user.displayName), text: m.replyTo.deletedAt ? null : m.replyTo.text } : null,
});

// GET /api/chat/:matchId?after=<ISO time> — the latest 50 messages, or only newer ones (polling).
router.get("/:matchId", limit("chat-read", 600, 10), async (req, res) => {
  const id = matchId.safeParse(req.params.matchId);
  if (!id.success) return res.status(400).json({ error: "Unknown match", code: "BAD_MATCH" });
  const after = req.query.after ? new Date(String(req.query.after)) : null;
  const where = { matchId: id.data, deletedAt: null, ...(after && !isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) };
  const rows = await prisma.chatMessage.findMany({
    where, orderBy: { createdAt: "desc" }, take: 50,
    select: pick,
  });
  res.json({ messages: rows.reverse().map(dto) });
});

// POST /api/chat/:matchId { text, replyTo? } — replyTo is the id of a message in the same match.
router.post("/:matchId", requireAuth, limit("chat-post", 20, 5, byUser), async (req: AuthedRequest, res) => {
  const id = matchId.safeParse(req.params.matchId);
  if (!id.success) return res.status(400).json({ error: "Unknown match", code: "BAD_MATCH" });
  const text = String(req.body?.text ?? "").replace(/\s+/g, " ").trim();
  if (!text) return res.status(400).json({ error: "Write a message", code: "EMPTY" });
  if (text.length > MAX_LEN) return res.status(400).json({ error: `Keep it under ${MAX_LEN} characters`, code: "TOO_LONG" });
  if (LINK.test(text)) return res.status(400).json({ error: "Links and @handles aren't allowed in chat", code: "NO_LINKS" });
  if (hasPhone(text)) return res.status(400).json({ error: "Phone numbers aren't allowed in chat", code: "NO_PHONES" });

  const me = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! }, select: { chatMutedUntil: true } });
  if (me.chatMutedUntil && me.chatMutedUntil > new Date()) {
    return res.status(403).json({ error: `You can't post in chat until ${me.chatMutedUntil.toISOString()}`, code: "CHAT_MUTED", until: me.chatMutedUntil });
  }
  const replyTo = typeof req.body?.replyTo === "string" ? req.body.replyTo : null;
  if (replyTo) {
    const q = await prisma.chatMessage.findFirst({ where: { id: replyTo, matchId: id.data, deletedAt: null }, select: { id: true } });
    if (!q) return res.status(400).json({ error: "That message is no longer in the chat", code: "BAD_REPLY" });
  }
  if (hit("chat-gap", req.userId!, 1, 3000).over) return res.status(429).json({ error: "Slow down a little", code: "TOO_FAST" });
  const m = await prisma.chatMessage.create({
    data: { matchId: id.data, userId: req.userId!, text: clean(text), replyToId: replyTo },
    select: pick,
  });
  res.status(201).json(dto(m));
});

// Old chat is removed after KEEP_DAYS (run daily from index.ts).
export async function purgeOldChat() {
  const { count } = await prisma.chatMessage.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_DAYS * 86_400_000) } } });
  if (count) console.log(`chat: purged ${count} message(s) older than ${KEEP_DAYS} days`);
}

export default router;
