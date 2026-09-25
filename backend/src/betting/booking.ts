// Booking codes: save a slip (without a stake) under a short code that anyone can load later.
import { prisma } from "../lib/prisma";
import { newBookingCode, normaliseCode } from "./codes";
import { findMatches } from "./feed";
import { marketById } from "./markets";
import { BetError } from "./placeBet";
import { RULES } from "./rules";

export interface BookedLeg { matchId: string; market: string; selection: string }

// Each selection with its match and current price; ones that can't be bet any more come back
// in `unavailable` so the slip can say so.
async function withPrices(legs: BookedLeg[]) {
  const matches = await findMatches([...new Set(legs.map((l) => l.matchId))]);
  const available = [];
  const unavailable: BookedLeg[] = [];
  for (const l of legs) {
    const m = matches.get(l.matchId);
    const def = marketById(l.market);
    const col = def ? def.cols.indexOf(l.selection) : -1;
    const price = m && col !== -1 ? m.prices[l.market]?.[col] ?? 0 : 0;
    if (!m || m.state === "started" || !def || !(price > 1)) { unavailable.push(l); continue; }
    available.push({ ...l, marketLabel: def.label, odds: price, home: m.home, away: m.away, league: m.league, kickoff: m.kickoff, live: m.state === "live" });
  }
  return { available, unavailable };
}

export async function bookSlip(legs: BookedLeg[]) {
  if (!legs.length) throw new BetError("EMPTY_SLIP", "Add at least one selection");
  if (legs.length > RULES.maxSelections) throw new BetError("TOO_MANY_SELECTIONS", `A slip can hold up to ${RULES.maxSelections} selections`);
  const { available } = await withPrices(legs);
  if (!available.length) throw new BetError("SELECTIONS_UNAVAILABLE", "None of these selections can be booked right now", 409);
  const keep = available.map(({ matchId, market, selection }) => ({ matchId, market, selection }));
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newBookingCode();
    try {
      await prisma.bookedSlip.create({ data: { code, selections: keep } });
      return { code, count: keep.length };
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // code taken — pick another
    }
  }
  throw new BetError("BOOKING_FAILED", "Couldn't create a booking code. Try again.", 500);
}

export async function loadSlip(rawCode: string) {
  const code = normaliseCode(rawCode);
  const slip = code ? await prisma.bookedSlip.findUnique({ where: { code } }) : null;
  if (!slip) throw new BetError("CODE_NOT_FOUND", "No slip found with that booking code", 404);
  return { code, ...(await withPrices(slip.selections as unknown as BookedLeg[])) };
}
