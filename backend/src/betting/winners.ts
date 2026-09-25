// Recent real winning bets, for the Recent Winners strip (live mode). No names: players show
// as a masked number, the same one every time for the same account.
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { toNaira } from "./money";

const mask = (userId: string) => `*********${parseInt(createHash("sha256").update(userId).digest("hex").slice(0, 8), 16) % 10}`;

export async function recentWins(limit = 12) {
  const bets = await prisma.bet.findMany({
    where: { status: "WON", payout: { gt: 0 }, settledAt: { not: null } },
    orderBy: { settledAt: "desc" },
    take: limit,
    include: { selections: { select: { marketLabel: true } } },
  });
  return bets.map((b) => ({
    id: b.id,
    player: mask(b.userId),
    amount: toNaira(b.payout!),
    stake: toNaira(b.stake),
    product: "Sports",
    detail: b.type === "ACCUMULATOR" ? `${b.selections.length}-fold accumulator` : b.selections[0]?.marketLabel ?? "",
    at: b.settledAt!,
  }));
}
