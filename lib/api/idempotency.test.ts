import { IdempotencyKeyring, newIdempotencyKey, stableHash } from "./idempotency";

describe("stableHash", () => {
  it("ignores key order and is stable", () => {
    expect(stableHash({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      stableHash({ b: { d: [1, 2], c: 2 }, a: 1 }),
    );
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});

describe("IdempotencyKeyring", () => {
  it("reuses the key for the same payload and rotates when the payload changes", () => {
    const ring = new IdempotencyKeyring();
    const first = ring.keyFor({ amount: 10, note: "a" });
    expect(ring.keyFor({ note: "a", amount: 10 })).toBe(first);
    const second = ring.keyFor({ amount: 11, note: "a" });
    expect(second).not.toBe(first);
    expect(ring.rotate()).not.toBe(second);
  });

  it("produces backend-valid keys", () => {
    expect(newIdempotencyKey()).toMatch(/^[A-Za-z0-9_-]{1,200}$/);
  });
});
