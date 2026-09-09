import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { openTestVault, wipeVaults } from "@/lib/testing/vault";
import { account } from "@/lib/testing/vault";

import { setCurrentVault } from "./repository";
import { accountRecord } from "./schema";
import { clearSessionMarker, wipeThisDevice } from "./wipe";

const names = async (): Promise<string[]> =>
  (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => typeof name === "string");

describe("wipeThisDevice", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", { value: "", configurable: true, writable: true });
  });

  afterEach(async () => {
    setCurrentVault(null);
    await wipeVaults();
  });

  // P-32: the third exit. Everything this device holds goes, including work nobody else has — which
  // is why the sheet says the number first.
  it("drops the vault, its queue and the marker", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("accounts", accountRecord(account()));
    setCurrentVault(vault);
    expect(await names()).toContain("lf-vault-u1");

    await wipeThisDevice();

    expect(await names()).not.toContain("lf-vault-u1");
    expect(document.cookie).not.toContain("__Host-session=01920000");
  });

  it("says nothing and breaks nothing on a device with no vault", async () => {
    await expect(wipeThisDevice()).resolves.toBeUndefined();
  });

  it("expires the marker rather than rewriting it", () => {
    clearSessionMarker();

    expect(document.cookie).toContain("Max-Age=0");
  });
});
