import { v7 as uuidv7 } from "uuid";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export function newIdempotencyKey(): string {
  return uuidv7();
}

export function stableHash(payload: unknown): string {
  const json = JSON.stringify(payload, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : value,
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export const KEYRING_MAX = 32;

// One key per distinct payload: a retry of the same body reuses it, an edited body gets a new one.
export class IdempotencyKeyring {
  private keys = new Map<string, string>();
  private last: string | null = null;

  keyFor(payload: unknown): string {
    const hash = stableHash(payload);
    this.last = hash;
    const known = this.keys.get(hash);
    if (known !== undefined) return known;
    const key = newIdempotencyKey();
    this.keys.set(hash, key);
    // A form types its way through many bodies; only the oldest of them can no longer be retried.
    if (this.keys.size > KEYRING_MAX) {
      const oldest = this.keys.keys().next();
      if (!oldest.done) this.keys.delete(oldest.value);
    }
    return key;
  }

  rotate(): string {
    const key = newIdempotencyKey();
    if (this.last !== null) this.keys.set(this.last, key);
    return key;
  }
}
