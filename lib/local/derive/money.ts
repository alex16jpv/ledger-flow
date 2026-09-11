// Added in minor units, divided once: as floats eur-madrid's `current` is 2378.6800000000003.
export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => cents / 100;

export function sumAmounts(amounts: Iterable<number>): number {
  let cents = 0;
  for (const amount of amounts) cents += toCents(amount);
  return fromCents(cents);
}
