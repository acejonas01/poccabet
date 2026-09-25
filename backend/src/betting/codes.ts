// Short, easy-to-read codes: no 0/O or 1/I/L, so they can be read out and typed without mix-ups.
import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const random = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export const newTicket = () => `PB${random(6)}`; // a placed bet, for "Check a bet"
export const newBookingCode = () => random(6); // a booked slip, for "Load"
export const normaliseCode = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
