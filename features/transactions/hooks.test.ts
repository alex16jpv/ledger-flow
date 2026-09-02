import { transactionKeys } from "./keys";

describe("transactionKeys", () => {
  it("nests every key under the feature root", () => {
    expect(transactionKeys.pendingCount()[0]).toBe("transactions");
  });
});
