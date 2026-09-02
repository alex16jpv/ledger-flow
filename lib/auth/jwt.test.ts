import { decodeAccessToken, isExpired } from "./jwt";

const encode = (payload: object) =>
  `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;

describe("decodeAccessToken", () => {
  it("reads the payload without verifying", () => {
    const claims = decodeAccessToken(encode({ userId: "u1", email: "a@b.co", exp: 1_800_000_000 }));
    expect(claims).toMatchObject({ userId: "u1", email: "a@b.co" });
  });

  it("rejects malformed tokens", () => {
    expect(decodeAccessToken("nope")).toBeNull();
    expect(decodeAccessToken(encode({ sub: "x" }))).toBeNull();
    expect(decodeAccessToken(null)).toBeNull();
  });

  it("knows when the access token expired", () => {
    expect(isExpired({ userId: "u", exp: 1000 }, 1_000_001)).toBe(true);
    expect(isExpired({ userId: "u", exp: 2000 }, 1_000_000)).toBe(false);
    expect(isExpired(null)).toBe(false);
  });
});
