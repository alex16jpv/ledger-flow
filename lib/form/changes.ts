// §6 O-F5a: only touched fields travel; an empty body is refused by every `PUT` (§1 example 3).
export function nothingChanged(changes: object): boolean {
  return Object.keys(changes).length === 0;
}

export function changedOnly<T extends object>(
  values: T,
  dirty: Partial<Record<keyof T, unknown>>,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => dirty[key as keyof T]),
  ) as Partial<T>;
}
