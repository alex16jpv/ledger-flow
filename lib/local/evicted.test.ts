import { setErrorReporter } from "@/lib/observability/reporter";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import {
  forgetVaultsOpened,
  noteVaultOpened,
  reportVaultEvictionIfAny,
  VaultEvictedError,
} from "./evicted";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 5);

const reported: unknown[] = [];

beforeEach(() => {
  reported.length = 0;
  localStorage.clear();
  setErrorReporter((error) => reported.push(error));
});

afterEach(async () => {
  setErrorReporter(null);
  await wipeVaults();
});

describe("the vault eviction event (D-20)", () => {
  it("says nothing while the vault is still there", async () => {
    const vault = await openTestVault("u1");
    vault.close();

    expect(await reportVaultEvictionIfAny("u1", NOW - 10 * DAY, NOW)).toBe(false);
    expect(reported).toEqual([]);
  });

  it("reports the mode and how long the vault had been sitting", async () => {
    noteVaultOpened("u1", NOW - 9 * DAY);

    expect(await reportVaultEvictionIfAny("u1", NOW - 40 * DAY, NOW)).toBe(true);
    expect(reported).toHaveLength(1);
    const error = reported[0] as VaultEvictedError;
    expect(error).toBeInstanceOf(VaultEvictedError);
    expect(error.daysSinceLastOpen).toBe(9);
    expect(error.daysSinceMarker).toBe(40);
    // jsdom is not a standalone display, so this is the tab half of the §4.3 pair.
    expect(error.mode).toBe("browser");
  });

  it("still reports when the eviction took the timestamp with it", async () => {
    // WebKit clears every script-writable store at once, localStorage included.
    expect(await reportVaultEvictionIfAny("u1", NOW - 12 * DAY, NOW)).toBe(true);
    const error = reported[0] as VaultEvictedError;
    expect(error.daysSinceLastOpen).toBeNull();
    expect(error.daysSinceMarker).toBe(12);
  });

  it("does not blame the browser for a device that never had a vault", async () => {
    expect(await reportVaultEvictionIfAny("u1", Number.NaN, NOW)).toBe(false);
    expect(reported).toEqual([]);
  });

  it("says nothing on the sign-in that stamps the marker", async () => {
    expect(await reportVaultEvictionIfAny("u1", NOW - 60_000, NOW)).toBe(false);
    expect(reported).toEqual([]);
  });

  it("counts the days per user, so a first sign-in beside another account is not a loss", async () => {
    noteVaultOpened("u1", NOW - 3 * DAY);

    expect(await reportVaultEvictionIfAny("u2", NOW - 60_000, NOW)).toBe(false);
    expect(reported).toEqual([]);
  });

  it("forgets the marks a wipe of this device took the vaults with", async () => {
    noteVaultOpened("u1", NOW - 3 * DAY);
    forgetVaultsOpened();

    expect(await reportVaultEvictionIfAny("u1", NOW - 3 * DAY, NOW)).toBe(false);
    expect(reported).toEqual([]);
  });

  it("does not answer where the browser cannot list its databases", async () => {
    noteVaultOpened("u1", NOW - 9 * DAY);
    // Firefox: `indexedDB.databases()` does not exist, so "no vault" is unknown, not a loss.
    Object.defineProperty(indexedDB, "databases", { value: undefined, configurable: true });

    try {
      expect(await reportVaultEvictionIfAny("u1", NOW - 40 * DAY, NOW)).toBe(false);
      expect(reported).toEqual([]);
    } finally {
      Reflect.deleteProperty(indexedDB, "databases");
    }
  });
});
