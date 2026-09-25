// Nigerian mobile numbers. Accepts what people type — 08030999969, 8030999969, 2348030999969,
// +234 803 099 9969 — and stores one form: +2348030999969. Mobile numbers start 70/71, 80/81, 90/91.
export function normaliseNgPhone(input: string): string | null {
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[789][01]\d{8}$/.test(d) ? `+234${d}` : null;
}

// +2348030999969 → "+234 803 099 9969"
export const formatNgPhone = (e164: string) => e164.replace(/^\+234(\d{3})(\d{3})(\d{4})$/, "+234 $1 $2 $3");
