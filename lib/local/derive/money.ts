// Every figure is added in minor units and divided once at the end: 0.10 + 0.20 + 19.99 + 2.30 in
// floats is 22.590000000000003, and the parity fixtures carry that sum on purpose.
export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => cents / 100;

export function sumAmounts(amounts: Iterable<number>): number {
  let cents = 0;
  for (const amount of amounts) cents += toCents(amount);
  return fromCents(cents);
}
