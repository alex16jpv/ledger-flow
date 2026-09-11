import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, wipeVaults } from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import { VAULT } from "./db";
import { forceFullResync, PULL_STALE_MS, startMirror } from "./mirror";
import type { PullPageQuery } from "./pull";
import { currentVault, expectVault, read, resetVaultGate, setCurrentVault } from "./repository";
import { PROFILE_KEY, vaultDatabaseName } from "./schema";

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");
const persist = vi.fn().mockResolvedValue(true);
// The feed of this suite never carries a profile, and the mirror asks for it when it is missing.
const meResponse = () =>
  new Response(JSON.stringify({ user: { id: "u1", name: "Ada", timezone: "America/Bogota" } }), {
    headers: { "content-type": "application/json" },
  });

const feed: SyncChangesResponse = {
  serverTime: "2026-09-03T12:00:00.000Z",
  changes: {
    user: null,
    accounts: [account({ id: "a1" })],
    categories: [],
    transactions: [],
    budgets: [],
  },
  pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "v1|done|" },
};

let queries: PullPageQuery[] = [];
let clock = 0;
let answer: (page: SyncChangesResponse) => void = () => undefined;
const onChanged = vi.fn();

function start(pending = false): () => void {
  return startMirror("u1", {
    now: () => clock,
    onChanged,
    pull: {
      fetchPage: (query) => {
        queries.push(query);
        if (!pending) return Promise.resolve(feed);
        return new Promise<SyncChangesResponse>((resolve) => {
          answer = resolve;
        });
      },
    },
  });
}

beforeEach(() => {
  queries = [];
  clock = 1_000_000;
  persist.mockClear();
  onChanged.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(meResponse())),
  );
  Object.defineProperty(navigator, "storage", {
    value: { persisted: vi.fn().mockResolvedValue(false), persist },
    configurable: true,
  });
});

afterEach(async () => {
  if (originalStorage) Object.defineProperty(navigator, "storage", originalStorage);
  vi.unstubAllGlobals();
  setCurrentVault(null);
  resetVaultGate();
  connectivityStore.reset();
  await wipeVaults();
});

describe("another tab upgrading the schema (F-14)", () => {
  it("stops serving from a handle the browser closed under it", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(currentVault()?.userId).toBe("u1");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    // Holding the connection through a `versionchange` would stall the newer tab forever.
    const other = indexedDB.open(vaultDatabaseName("u1"), VAULT.schemaVersion + 1);
    await new Promise<void>((resolve) => {
      other.onsuccess = () => {
        other.result.close();
        resolve();
      };
      other.onblocked = () => {
        resolve();
      };
    });

    // Before this, the handle stayed in place and the next read threw `InvalidStateError`.
    await vi.waitFor(() => {
      expect(currentVault()).toBeNull();
    });
    warn.mockRestore();
    stop();
  });
});

describe("startMirror", () => {
  it("opens the vault, asks for durable storage and fills the mirror", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(queries).toHaveLength(1);
    });

    const vault = currentVault();
    expect(vault?.userId).toBe("u1");
    expect(persist).toHaveBeenCalledOnce();
    await expect(vault?.db.count("accounts")).resolves.toBe(1);
    stop();
  });

  it("pulls again on focus only once the copy is stale", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(queries).toHaveLength(1);
    });

    window.dispatchEvent(new Event("focus"));
    expect(queries).toHaveLength(1);

    clock += PULL_STALE_MS;
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => {
      expect(queries).toHaveLength(2);
    });
    expect(queries[1]?.cursor).toBe("v1|done|");
    stop();
  });

  it("pulls when the network comes back", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(queries).toHaveLength(1);
    });

    reportOnline(false);
    reportOnline(true);
    await vi.waitFor(() => {
      expect(queries).toHaveLength(2);
    });
    stop();
  });

  // F-32: a request arriving mid-pull joins the one in flight, which cannot carry later writes.
  it("pulls once more when a request arrives while a pull is in flight", async () => {
    const stop = start(true);
    await vi.waitFor(() => {
      expect(queries).toHaveLength(1);
    });

    reportOnline(false);
    reportOnline(true);
    expect(queries).toHaveLength(1);

    answer(feed);
    await vi.waitFor(() => {
      expect(queries).toHaveLength(2);
    });
    answer(feed);
    stop();
  });

  // F-31: a read that waited for this vault has to be answered even when none opens.
  it("stops the waiting reads when there is no vault to open", async () => {
    expectVault();
    vi.stubGlobal("indexedDB", undefined);
    const stop = start();

    await expect(
      read(
        () => Promise.resolve("server"),
        () => Promise.resolve("mirror"),
      ),
    ).resolves.toBe("server");
    stop();
  });

  // F-38: the pull writes behind React Query's back, so only news may trigger a re-read.
  it("says the mirror changed once, and not again when the overlap replays the same row", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });

    clock += PULL_STALE_MS;
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => {
      expect(queries).toHaveLength(2);
    });
    expect(onChanged).toHaveBeenCalledOnce();
    stop();
  });

  it("stops answering reads from the vault once it is torn down", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(currentVault()).not.toBeNull();
    });

    stop();

    expect(currentVault()).toBeNull();
    clock += PULL_STALE_MS;
    window.dispatchEvent(new Event("focus"));
    expect(queries).toHaveLength(1);
  });

  // The resync empties the copy first, so saying Resynced over a failed pass is the worst answer.
  it("rejects when the pull that should refill the copy failed", async () => {
    const stop = startMirror("u1", {
      now: () => clock,
      pull: { fetchPage: () => Promise.reject(new Error("no network")) },
    });
    await vi.waitFor(() => {
      expect(currentVault()).not.toBeNull();
    });

    await expect(forceFullResync("u1")).rejects.toThrow("no network");
    stop();
  });

  it("says it could not resync when no mirror is there to refill the copy", async () => {
    await expect(forceFullResync("u1")).rejects.toThrow(/no mirror is open/);
  });

  // H-14: `changes.user` is null unless the profile changed, so a mirror can end with no zone.
  it("asks the server for the profile when the feed never carried it", async () => {
    const stop = start();

    await vi.waitFor(async () => {
      expect(await currentVault()?.db.get("profile", PROFILE_KEY)).toBeDefined();
    });
    const profile = await currentVault()?.db.get("profile", PROFILE_KEY);
    expect(profile?.row.timezone).toBe("America/Bogota");

    stop();
  });
});
