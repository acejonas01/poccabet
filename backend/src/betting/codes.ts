// Short, easy-to-read codes: no 0/O or 1/I/L, so they can be read out and typed without mix-ups.
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const random = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

// A placed bet's ticket ID, for "Check a bet": 12 random digits, stored bare and shown as
// "PB4817-2093-6651" (the site adds the PB and dashes). Long
// numbers can't be mistaken for booking codes (short letters). Random, never date-based: anyone can
// look a ticket up without logging in, so IDs mustn't be guessable. Older tickets are "PB" + 6.
export const newTicket = () => String(randomInt(1, 10)) + Array.from({ length: 11 }, () => randomInt(10)).join("");
// A ticket ID nobody has yet (a clash is about one in a trillion, but a unique-key error would undo the bet).
export async function freshTicket(taken: (ticket: string) => Promise<boolean>) {
  for (;;) { const t = newTicket(); if (!(await taken(t))) return t; }
}
export const newBookingCode = () => random(6); // a booked slip, for "Load"
export const normaliseCode = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
// A ticket as typed ("PB4817-2093-6651", "4817 2093 6651", "pb7k2m9q") → as stored.
export const ticketKey = (s: string) => { const c = normaliseCode(s); return /^PB\d{12}$/.test(c) ? c.slice(2) : c; };
