import { setErrorReporter } from "@/lib/observability/reporter";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { noteVaultOpened, reportVaultEvictionIfAny, VaultEvictedError } from "./evicted";

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
    noteVaultOpened(NOW - 9 * DAY);

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
});
