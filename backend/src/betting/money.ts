// Money is kept in kobo (₦1 = 100 kobo) as whole numbers; the API talks in naira.
export const toKobo = (naira: number) => Math.round(naira * 100);
export const toNaira = (kobo: number) => kobo / 100;
export const formatNaira = (kobo: number) =>
  `₦${toNaira(kobo).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
