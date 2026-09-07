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

// One key per distinct payload: a retry of the same body reuses it, an edited body gets a new one.
export class IdempotencyKeyring {
  private hash: string | null = null;
  private key: string | null = null;

  keyFor(payload: unknown): string {
    const hash = stableHash(payload);
    if (this.key === null || hash !== this.hash) {
      this.hash = hash;
      this.key = newIdempotencyKey();
    }
    return this.key;
  }

  rotate(): string {
    this.key = newIdempotencyKey();
    return this.key;
  }
}
