import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isLocalOnly, setLocalOnly } from "@/lib/network/local-only";
import { markOfflineReadyAnnounced, offlineReadyAnnounced } from "@/lib/pwa/readiness";
import { requestLogout } from "@/lib/session/api";
import { tabChannel } from "@/lib/session/channel";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";
import { account } from "@/lib/testing/vault";

import { noteVaultOpened, reportVaultEvictionIfAny } from "./evicted";
import { setCurrentVault } from "./repository";
import { accountRecord, vaultDatabaseName } from "./schema";
import { clearSessionMarker, WIPE_PATIENCE_MS, WipeIncompleteError, wipeThisDevice } from "./wipe";

vi.mock("@/lib/session/api", () => ({ requestLogout: vi.fn() }));

const names = async (): Promise<string[]> =>
  (await indexedDB.databases())
    .map((database) => database.name)
    .filter((name): name is string => typeof name === "string");

describe("wipeThisDevice", () => {
  beforeEach(() => {
    Object.defineProperty(document, "cookie", { value: "", configurable: true, writable: true });
    vi.mocked(requestLogout).mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(async () => {
    vi.useRealTimers();
    setLocalOnly(false);
    vi.restoreAllMocks();
    setCurrentVault(null);
    await wipeVaults();
  });

  // T-166: the other tabs say everything was deleted, so they hear it only once it is true.
  it("tells the other tabs once everything is dropped", async () => {
    await openTestVault("u1").then((vault) => {
      vault.close();
    });
    const seen: string[][] = [];
    const post = vi.spyOn(tabChannel, "post").mockImplementation((message) => {
      if (message.type === "device:wiped") void names().then((list) => seen.push(list));
    });

    await wipeThisDevice();

    expect(post).toHaveBeenCalledWith({ type: "device:wiped" });
    await vi.waitFor(() => {
      expect(seen).toHaveLength(1);
    });
    expect(seen[0]).not.toContain(vaultDatabaseName("u1"));
  });

  it("signs this device out, so no tab can download the copy again", async () => {
    await wipeThisDevice();

    expect(requestLogout).toHaveBeenCalledOnce();
  });

  it("still deletes everything when the sign-out cannot reach the server", async () => {
    vi.mocked(requestLogout).mockRejectedValue(new TypeError("Failed to fetch"));
    await openTestVault("u1").then((vault) => {
      vault.close();
    });

    await wipeThisDevice();

    expect(await names()).not.toContain(vaultDatabaseName("u1"));
  });

  it("leaves this-device-only, which was a choice about the copy it deletes", async () => {
    setLocalOnly(true);

    await wipeThisDevice();

    expect(isLocalOnly()).toBe(false);
  });

  it("says it could not finish, and keeps the session and the choice, when a connection never lets go", async () => {
    const stuck = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open(vaultDatabaseName("u1"));
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
    setLocalOnly(true);
    const post = vi.spyOn(tabChannel, "post");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    let outcome: unknown = null;
    void wipeThisDevice().catch((error: unknown) => {
      outcome = error;
    });
    for (let turn = 0; turn < 20 && outcome === null; turn += 1) {
      await vi.advanceTimersByTimeAsync(WIPE_PATIENCE_MS);
    }

    expect(outcome).toBeInstanceOf(WipeIncompleteError);
    expect(post).not.toHaveBeenCalled();
    expect(requestLogout).not.toHaveBeenCalled();
    expect(isLocalOnly()).toBe(true);

    stuck.close();
  });

  // P-32: everything this device holds goes, which is why the sheet says the number first.
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
