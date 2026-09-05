// Every figure is added in minor units and divided once at the end: as a running float sum,
// 1000 − 10.10 + 1500 − 7.77 − 100 − 3.45 is 2378.6800000000003 (the `current` balance of eur-madrid).
export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => cents / 100;

export function sumAmounts(amounts: Iterable<number>): number {
  let cents = 0;
  for (const amount of amounts) cents += toCents(amount);
  return fromCents(cents);
}
