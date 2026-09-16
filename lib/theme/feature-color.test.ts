import { COLOR_TOKENS, randomColorToken } from "./feature-color";

describe("randomColorToken", () => {
  it("returns the first token for the bottom of the range and the last for the top", () => {
    expect(randomColorToken(() => 0)).toBe("RED");
    expect(randomColorToken(() => 0.999_999)).toBe("BLACK");
  });

  it("can reach every one of the 16 tokens", () => {
    const reached = COLOR_TOKENS.map((_, index) =>
      randomColorToken(() => index / COLOR_TOKENS.length),
    );
    expect(reached).toEqual([...COLOR_TOKENS]);
  });

  it("is not always the same colour", () => {
    const drawn = new Set(Array.from({ length: 200 }, () => randomColorToken()));
    expect(drawn.size).toBeGreaterThan(1);
    for (const color of drawn) expect(COLOR_TOKENS).toContain(color);
  });
});
