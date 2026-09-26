// Settling bets: grade selections whose match is over, then pay out (or close) the bets.
// Safe to run any number of times, in parallel too — a bet is only ever paid once.
import { prisma } from "../lib/prisma";
import { betOutcome, gradeSelection } from "./grade";
import { getResults } from "./results";
import { recordResult } from "./catalog";

const MATCH_OVER_AFTER = 105 * 60_000; // kickoff + 105 min: a match (with half-time) should be finished
const GIVE_UP_AFTER = 72 * 3600_000; // no result 3 days after kickoff: void the selection (stake back on singles)

export async function settlePending(now = Date.now(), batch = 300) {
  // 1. Selections still waiting whose match should be over.
  const due = await prisma.betSelection.findMany({
    where: { result: "PENDING", matchId: { not: "" }, kickoff: { lte: new Date(now - MATCH_OVER_AFTER) } },
    select: { id: true, betId: true, matchId: true, kickoff: true, market: true, selection: true },
    orderBy: { kickoff: "asc" },
    take: batch,
  });
  if (!due.length) return { graded: 0, settled: 0 };

  const matches = [...new Map(due.map((d) => [d.matchId, { matchId: d.matchId, kickoff: d.kickoff! }])).values()];
  const results = await getResults(matches, now);

  // 2. Grade them.
  const byGrade: Record<string, string[]> = { WON: [], LOST: [], VOID: [] };
  for (const d of due) {
    const r = results.get(d.matchId);
    let grade: string | null = null;
    if (r?.status === "FINISHED") grade = gradeSelection(d.market, d.selection, r);
    else if (r?.status === "VOID") grade = "VOID";
    if (!grade && now - d.kickoff!.getTime() > GIVE_UP_AFTER) grade = "VOID";
    if (grade) byGrade[grade].push(d.id);
  }
  let graded = 0;
  for (const [result, ids] of Object.entries(byGrade)) {
    if (!ids.length) continue;
    graded += (await prisma.betSelection.updateMany({ where: { id: { in: ids }, result: "PENDING" }, data: { result, settledAt: new Date(now) } })).count;
  }
  // Keep each match's result on its catalog event (score, 1/X/2, selection results).
  for (const [matchId, r] of results) {
    if (r.status === "FINISHED") await recordResult(matchId, { status: "FINISHED", score: r }, now);
    else if (r.status === "VOID") await recordResult(matchId, { status: "VOID" }, now);
  }

  // 3. Settle the bets those selections belong to.
  let settled = 0;
  for (const betId of new Set(due.map((d) => d.betId))) if (await settleBet(betId, now)) settled++;
  return { graded, settled };
}

export async function settleBet(betId: string, now = Date.now()) {
  const bet = await prisma.bet.findUnique({ where: { id: betId }, include: { selections: true } });
  if (!bet || bet.status !== "PENDING") return false;
  const out = betOutcome(bet.selections.map((s) => ({ result: s.result, odds: s.oddsAtPlacement })), bet.stake);
  if (out.status === "PENDING") return false;

  return prisma.$transaction(async (tx) => {
    // Claim the bet first: only the run that flips it from PENDING pays it.
    const claimed = await tx.bet.updateMany({
      where: { id: bet.id, status: "PENDING" },
      data: { status: out.status, payout: out.payout, settledAt: new Date(now) },
    });
    if (claimed.count !== 1) return false;
    if (out.payout > 0) {
      const wallet = await tx.wallet.update({ where: { userId: bet.userId }, data: { balance: { increment: out.payout } } });
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: out.status === "VOID" ? "BET_REFUND" : "BET_PAYOUT",
          amount: out.payout,
          balanceBefore: wallet.balance - out.payout,
          balanceAfter: wallet.balance,
          reference: bet.id,
          betId: bet.id,
          status: "COMPLETED",
        },
      });
    }
    return true;
  });
}

// ---------- running it ----------
// Every minute while the server is up, and also on demand (e.g. when someone opens My Bets,
// so a server that was asleep catches up straight away). Runs never overlap.
let running: Promise<unknown> | null = null;
let lastStart = 0;

export function maybeSettle(minGapMs = 30_000): Promise<unknown> {
  if (running) return running;
  if (Date.now() - lastStart < minGapMs) return Promise.resolve();
  lastStart = Date.now();
  running = settlePending()
    .then((r) => { if (r.settled || r.graded) console.log(`settlement: ${r.graded} selections graded, ${r.settled} bets settled`); })
    .catch((err) => console.error("settlement failed:", err))
    .finally(() => { running = null; });
  return running;
}

export function startSettlementLoop() {
  maybeSettle(0);
  setInterval(() => maybeSettle(), 60_000).unref();
}
