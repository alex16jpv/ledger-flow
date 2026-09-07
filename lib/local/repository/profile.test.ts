import { openTestVault, profile, wipeVaults } from "@/lib/testing/vault";

import { profileRecord } from "../schema";
import { readMirrorProfile } from "./profile";
import { resetVaultGate, setCurrentVault } from "./read";

afterEach(async () => {
  setCurrentVault(null);
  resetVaultGate();
  await wipeVaults();
});

describe("readMirrorProfile", () => {
  it("answers the profile the pull stored", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put(
      "profile",
      profileRecord(profile({ name: "Ana", currency: "EUR", timezone: "Europe/Madrid" })),
    );
    setCurrentVault(vault);

    await expect(readMirrorProfile()).resolves.toMatchObject({
      name: "Ana",
      currency: "EUR",
      timezone: "Europe/Madrid",
    });
  });

  it("answers null with no vault, and before the first snapshot", async () => {
    await expect(readMirrorProfile()).resolves.toBeNull();

    setCurrentVault(await openTestVault("u1"));
    await expect(readMirrorProfile()).resolves.toBeNull();
  });
});
