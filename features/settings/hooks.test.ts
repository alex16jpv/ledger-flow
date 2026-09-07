import { settingsKeys } from "./keys";

describe("settingsKeys", () => {
  it("nests every key under the feature root", () => {
    expect(settingsKeys.sessions()[0]).toBe("settings");
  });
});
