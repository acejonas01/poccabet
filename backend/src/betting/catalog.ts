// The sports catalog in the database: sports → leagues → events → markets → selections.
// The feed itself lives in memory; a match, its markets and selections are stored here the first
// time someone bets on them, and every bet leg links to them. When a match's result is known,
// the event keeps the score and each stored selection gets its result. This is what analytics
// (and the reporting views) join on.
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { BettableMatch } from "./feed";
import { gradeSelection, type Score } from "./grade";

export const leagueSlugOf = (country: string, league: string) =>
  `${country} ${league}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Two requests creating the same row at the same moment: the loser just reads the winner's row.
async function upsertOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return fn();
    throw err;
  }
}

let footballId: string | null = null;
async function sportId() {
  if (footballId) return footballId;
  const s = await upsertOnce(() => prisma.sport.upsert({ where: { slug: "football" }, create: { slug: "football", name: "Football" }, update: {} }));
  return (footballId = s.id);
}

async function eventFor(m: BettableMatch) {
  const sport = await sportId();
  const slug = leagueSlugOf(m.country, m.league);
  const league = await upsertOnce(() => prisma.league.upsert({
    where: { slug }, create: { slug, sportId: sport, name: m.league, country: m.country }, update: {},
  }));
  return upsertOnce(() => prisma.event.upsert({
    where: { externalId: m.matchId },
    create: {
      externalId: m.matchId, sportId: sport, leagueId: league.id, league: m.league, country: m.country,
      homeTeam: m.home, awayTeam: m.away, startTime: m.kickoff, status: m.state === "live" ? "LIVE" : "SCHEDULED",
    },
    update: { startTime: m.kickoff, ...(m.state === "live" ? { status: "LIVE" } : {}) },
  }));
}

export type LegIds = { eventId: string; marketId: string; outcomeId: string };

// Catalog ids for each leg of a slip (null for a leg that couldn't be stored: the bet still goes
// through, just without the links).
export async function catalogLegs(legs: { match: BettableMatch; market: string; marketLabel: string; selection: string; odds: number }[]): Promise<(LegIds | null)[]> {
  const events = new Map<string, Promise<{ id: string } | null>>();
  return Promise.all(legs.map(async (l) => {
    try {
      if (!events.has(l.match.matchId)) events.set(l.match.matchId, eventFor(l.match).catch((e) => { console.error("catalog event:", e); return null; }));
      const event = await events.get(l.match.matchId);
      if (!event) return null;
      const market = await upsertOnce(() => prisma.market.upsert({
        where: { eventId_code: { eventId: event.id, code: l.market } },
        create: { eventId: event.id, code: l.market, type: l.market.toUpperCase(), name: l.marketLabel || l.market },
        update: {},
      }));
      const outcome = await upsertOnce(() => prisma.outcome.upsert({
        where: { marketId_code: { marketId: market.id, code: l.selection } },
        create: { marketId: market.id, code: l.selection, label: l.selection, odds: l.odds },
        update: { odds: l.odds }, // latest price bet at
      }));
      return { eventId: event.id, marketId: market.id, outcomeId: outcome.id };
    } catch (err) {
      console.error("catalog leg:", err);
      return null;
    }
  }));
}

// A match's final result (or that it was void): saved on the event, its markets and selections.
// Safe to call more than once; only the first call writes.
export async function recordResult(matchId: string, r: { status: "FINISHED"; score: Score } | { status: "VOID" }, now = Date.now()) {
  try {
    const event = await prisma.event.findUnique({ where: { externalId: matchId }, include: { markets: { include: { outcomes: true } } } });
    if (!event || event.settledAt) return;
    const at = new Date(now);
    const s = r.status === "FINISHED" ? r.score : null;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.event.updateMany({
        where: { id: event.id, settledAt: null },
        data: s
          ? { status: "FINISHED", homeScore: s.home, awayScore: s.away, htHomeScore: s.htHome, htAwayScore: s.htAway, result: s.home > s.away ? "1" : s.home < s.away ? "2" : "X", settledAt: at }
          : { status: "CANCELLED", result: "VOID", settledAt: at },
      });
      if (claimed.count !== 1) return;
      for (const m of event.markets) {
        if (!m.code) continue;
        for (const o of m.outcomes) {
          if (!o.code) continue;
          const result = s ? gradeSelection(m.code, o.code, s) : "VOID";
          if (result) await tx.outcome.update({ where: { id: o.id }, data: { result, status: "SETTLED" } });
        }
        await tx.market.update({ where: { id: m.id }, data: { status: "SETTLED", settledAt: at } });
      }
    });
  } catch (err) {
    console.error(`recording result for ${matchId} failed:`, err);
  }
}
