import { unsentTheme } from "./unsent";

const KEY = "lf.themeUnsent";
const DARK_TINTA = { palette: "tinta", mode: "dark" } as const;
const LIGHT_BRISA = { palette: "brisa", mode: "light" } as const;

beforeEach(() => {
  window.localStorage.clear();
});

describe("unsentTheme", () => {
  it("hands a choice back only for the user who made it", () => {
    unsentTheme.mark("u1", DARK_TINTA);

    expect(unsentTheme.read("u1")).toEqual(DARK_TINTA);
    expect(unsentTheme.read("u2")).toBeNull();
  });

  it("keeps a newer choice when an older one finishes sending", () => {
    unsentTheme.mark("u1", DARK_TINTA);
    unsentTheme.mark("u1", LIGHT_BRISA);

    unsentTheme.clear(DARK_TINTA);
    expect(unsentTheme.read("u1")).toEqual(LIGHT_BRISA);

    unsentTheme.clear(LIGHT_BRISA);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("forgets any choice when cleared without one", () => {
    unsentTheme.mark("u1", DARK_TINTA);
    unsentTheme.clear();
    expect(unsentTheme.read("u1")).toBeNull();
  });

  it("ignores a stored value it cannot read", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(unsentTheme.read("u1")).toBeNull();
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ userId: "u1", palette: "neon", mode: "dark" }),
    );
    expect(unsentTheme.read("u1")).toBeNull();
  });
});
