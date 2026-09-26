// Placing bets: validate the slip, re-price it from the feed, take the stake and save the bets
// in one database transaction.
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { newTicket } from "./codes";
import { FEED_SOURCE, findMatches } from "./feed";
import { formatNaira, toNaira } from "./money";
import { type LegRequest, type OddsPolicy, type PricedLeg, payoutKobo, priceLegs, totalOdds } from "./pricing";
import { RULES } from "./rules";
import { catalogLegs } from "./catalog";

export class BetError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

export interface PlaceInput {
  mode: "single" | "multiple";
  stakeKobo: number; // per bet (each single, or the one accumulator)
  selections: LegRequest[];
  acceptOdds: OddsPolicy;
  idempotencyKey?: string; // one per slip submission, sent again if the request is retried
}

const betInclude = { selections: { include: { outcome: { include: { market: { include: { event: true } } } } } } } as const;
type BetRow = Prisma.BetGetPayload<{ include: typeof betInclude }>;

// What the API returns for a bet (naira, and the same shape for old and new bets).
export function betDto(b: BetRow) {
  return {
    id: b.id,
    ticket: b.ticket,
    type: b.type,
    status: b.status,
    stake: toNaira(b.stake),
    totalOdds: b.totalOdds,
    potentialPayout: toNaira(b.potentialPayout),
    payout: b.payout === null ? null : toNaira(b.payout),
    source: b.source,
    createdAt: b.createdAt,
    settledAt: b.settledAt,
    selections: b.selections.map((s) => {
      const ev = s.outcome?.market.event; // old Theme D bets
      return {
        matchId: s.matchId,
        home: s.home || ev?.homeTeam || "",
        away: s.away || ev?.awayTeam || "",
        league: s.league || ev?.league || "",
        country: s.country,
        kickoff: s.kickoff ?? ev?.startTime ?? null,
        market: s.market,
        marketLabel: s.marketLabel || s.outcome?.market.name || "",
        selection: s.selection || s.outcome?.label || "",
        odds: s.oddsAtPlacement,
        result: s.result,
      };
    }),
  };
}

// Bets placed with this key already (a retried request): return them instead of betting twice.
async function existingForKey(userId: string, key?: string) {
  if (!key) return null;
  const bets = await prisma.bet.findMany({
    where: { userId, OR: [{ idempotencyKey: key }, { idempotencyKey: { startsWith: `${key}:` } }] },
    include: betInclude,
    orderBy: { createdAt: "asc" },
  });
  return bets.length ? bets : null;
}

export async function placeBets(userId: string, input: PlaceInput, attempt = 0): Promise<{ bets: ReturnType<typeof betDto>[]; balance: number; repeated: boolean }> {
  const { mode, stakeKobo, selections, acceptOdds, idempotencyKey } = input;

  // ---- the slip itself ----
  if (!selections.length) throw new BetError("EMPTY_SLIP", "Add at least one selection");
  if (selections.length > RULES.maxSelections) throw new BetError("TOO_MANY_SELECTIONS", `A slip can hold up to ${RULES.maxSelections} selections`);
  if (!Number.isInteger(stakeKobo) || stakeKobo < RULES.minStake) throw new BetError("STAKE_TOO_LOW", `The minimum stake is ${formatNaira(RULES.minStake)}`);
  if (stakeKobo > RULES.maxStake) throw new BetError("STAKE_TOO_HIGH", `The maximum stake is ${formatNaira(RULES.maxStake)}`);
  const keys = selections.map((s) => `${s.matchId}|${s.market}|${s.selection}`);
  if (new Set(keys).size !== keys.length) throw new BetError("DUPLICATE_SELECTION", "The same selection is on the slip twice");
  if (mode === "multiple") {
    const matchIds = selections.map((s) => s.matchId);
    if (new Set(matchIds).size !== matchIds.length) {
      throw new BetError("SAME_MATCH", "A multiple can only have one selection per match");
    }
  }

  const already = await existingForKey(userId, idempotencyKey);
  if (already) return { bets: already.map(betDto), balance: await balanceNaira(userId), repeated: true };

  // ---- prices, from the feed (never from the client) ----
  const matches = await findMatches([...new Set(selections.map((s) => s.matchId))]);
  const { legs, problems } = priceLegs(selections, matches, acceptOdds);
  if (problems.length) {
    const changed = problems.every((p) => p.reason === "ODDS_CHANGED");
    throw new BetError(
      changed ? "ODDS_CHANGED" : "SELECTIONS_UNAVAILABLE",
      changed ? "Some odds have changed. Check the new prices and place again." : "Some selections can't be bet on any more.",
      409,
      { problems },
    );
  }

  // ---- the bets to create ----
  const planned: { type: "SINGLE" | "ACCUMULATOR"; legs: PricedLeg[]; odds: number; payout: number }[] =
    mode === "multiple" && legs.length > 1
      ? [{ type: "ACCUMULATOR", legs, odds: totalOdds(legs.map((l) => l.odds)), payout: payoutKobo(stakeKobo, legs.reduce((a, l) => a * l.odds, 1)) }]
      : legs.map((l) => ({ type: "SINGLE" as const, legs: [l], odds: l.odds, payout: payoutKobo(stakeKobo, l.odds) }));
  for (const p of planned) {
    if (p.payout > RULES.maxPayout) {
      throw new BetError("PAYOUT_TOO_HIGH", `The most a bet can win is ${formatNaira(RULES.maxPayout)}. Lower your stake or remove a selection.`);
    }
  }
  const totalStake = stakeKobo * planned.length;
  // Store the matches / markets / selections in the catalog (outside the money transaction).
  const ids = new Map(legs.map((l, i) => [l, i]));
  const catalog = await catalogLegs(legs);

  // ---- take the stake and save, all or nothing ----
  try {
    const bets = await prisma.$transaction(async (tx) => {
      // One UPDATE that only succeeds if the balance covers the stake: two taps at once can't overspend.
      const debit = await tx.wallet.updateMany({
        where: { userId, balance: { gte: totalStake } },
        data: { balance: { decrement: totalStake } },
      });
      if (debit.count !== 1) {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new BetError("NO_WALLET", "Wallet not found", 404);
        throw new BetError("INSUFFICIENT_FUNDS", `Your balance is ${formatNaira(wallet.balance)}. You need ${formatNaira(totalStake)} for this bet.`, 402);
      }
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      let running = wallet.balance + totalStake;

      const created: BetRow[] = [];
      for (const [i, p] of planned.entries()) {
        const bet = await tx.bet.create({
          data: {
            userId,
            ticket: newTicket(),
            stake: stakeKobo,
            totalOdds: p.odds,
            potentialPayout: p.payout,
            type: p.type,
            status: "PENDING",
            source: FEED_SOURCE,
            idempotencyKey: idempotencyKey ? (planned.length > 1 ? `${idempotencyKey}:${i}` : idempotencyKey) : null,
            selections: {
              create: p.legs.map((l) => ({
                matchId: l.match.matchId,
                home: l.match.home,
                away: l.match.away,
                league: l.match.league,
                country: l.match.country,
                kickoff: l.match.kickoff,
                market: l.market,
                marketLabel: l.marketLabel,
                selection: l.selection,
                oddsAtPlacement: l.odds,
                result: "PENDING",
                ...(catalog[ids.get(l)!] ?? {}),
              })),
            },
          },
          include: betInclude,
        });
        running -= stakeKobo;
        await tx.transaction.create({
          data: { walletId: wallet.id, type: "BET_STAKE", amount: -stakeKobo, balanceBefore: running + stakeKobo, balanceAfter: running, reference: bet.id, betId: bet.id, status: "COMPLETED" },
        });
        created.push(bet);
      }
      return { created, balance: wallet.balance };
    });
    return { bets: bets.created.map(betDto), balance: toNaira(bets.balance), repeated: false };
  } catch (err) {
    // The same submission arrived twice at the same moment: the second one lost the race.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      if (idempotencyKey) {
        const again = await existingForKey(userId, idempotencyKey);
        if (again) return { bets: again.map(betDto), balance: await balanceNaira(userId), repeated: true };
      }
      // Two tickets came out the same (about 1 in a billion): nothing was saved, so just try again.
      if (String(err.meta?.target ?? "").includes("ticket") && attempt < 2) return placeBets(userId, input, attempt + 1);
    }
    throw err;
  }
}

async function balanceNaira(userId: string) {
  const w = await prisma.wallet.findUnique({ where: { userId } });
  return toNaira(w?.balance ?? 0);
}

export { betInclude };
