import { changedOnly } from "./changes";

describe("changedOnly", () => {
  it("keeps the fields the form marked dirty, and nothing else", () => {
    const values = { name: "Nequi savings", type: "CASH", color: "BLUE" };

    expect(changedOnly(values, { color: true })).toEqual({ color: "BLUE" });
  });

  it("answers with nothing when nothing was touched", () => {
    expect(changedOnly({ name: "Cash" }, {})).toEqual({});
  });

  it("keeps a field whose new value is null or empty", () => {
    expect(changedOnly({ note: null, name: "" }, { note: true, name: true })).toEqual({
      note: null,
      name: "",
    });
  });
});
