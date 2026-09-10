import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markOfflineReadyAnnounced, offlineReadyAnnounced } from "@/lib/pwa/readiness";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";
import { account } from "@/lib/testing/vault";

import { noteVaultOpened, reportVaultEvictionIfAny } from "./evicted";
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

  // Left behind, the mark turns the next sign-in into an eviction the browser never made.
  it("forgets that this device ever opened a vault", async () => {
    noteVaultOpened("u1");
    expect(await reportVaultEvictionIfAny("u1", Date.now() - 60_000)).toBe(true);

    await wipeThisDevice();

    expect(await reportVaultEvictionIfAny("u1", Date.now() - 60_000)).toBe(false);
  });

  it("forgets the offline-ready announcement, so the next copy says it again", async () => {
    markOfflineReadyAnnounced();

    await wipeThisDevice();

    expect(offlineReadyAnnounced()).toBe(false);
  });
});
