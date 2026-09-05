import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, wipeVaults } from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import { PULL_STALE_MS, startMirror } from "./mirror";
import type { PullPageQuery } from "./pull";
import { currentVault, expectVault, read, resetVaultGate, setCurrentVault } from "./repository";

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");
const persist = vi.fn().mockResolvedValue(true);

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

function start(pending = false): () => void {
  return startMirror("u1", {
    now: () => clock,
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

  // F-32: a request that arrives mid-pull joins the one in flight, which cannot carry what the
  // server wrote after it started.
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
});
