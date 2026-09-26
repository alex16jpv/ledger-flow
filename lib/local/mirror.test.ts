import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, changes as feedChanges, wipeVaults } from "@/lib/testing/vault";
import type { SyncChangesResponse } from "@/types/api";

import { VAULT } from "./db";
import { forceFullResync, PULL_STALE_MS, pullNow, startMirror } from "./mirror";
import type * as Outbox from "./outbox";
import type { SyncEngineOptions } from "./outbox/engine";
import { type PullPageQuery, SessionChangedError } from "./pull";
import { purgeVault } from "./purge";
import { currentVault, expectVault, read, resetVaultGate, setCurrentVault } from "./repository";
import { PROFILE_KEY, vaultDatabaseName } from "./schema";

const engine = vi.hoisted(() => ({ options: undefined as SyncEngineOptions | undefined }));
vi.mock("./outbox", async (importOriginal) => {
  const original = await importOriginal<typeof Outbox>();
  return {
    ...original,
    startSyncEngine: (options?: SyncEngineOptions) => {
      engine.options = options;
      return original.startSyncEngine(options);
    },
  };
});

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");
const persist = vi.fn().mockResolvedValue(true);
// The feed of this suite never carries a profile, and the mirror asks for it when it is missing.
const meResponse = () =>
  new Response(JSON.stringify({ user: { id: "u1", name: "Ada", timezone: "America/Bogota" } }), {
    headers: { "content-type": "application/json" },
  });

const feed: SyncChangesResponse = {
  serverTime: "2026-09-03T12:00:00.000Z",
  changes: feedChanges({ accounts: [account({ id: "a1" })] }),
  pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "v1|done|" },
};

let queries: PullPageQuery[] = [];
let clock = 0;
let answer: (page: SyncChangesResponse) => void = () => undefined;
let failing = false;
const onChanged = vi.fn();

function start(pending = false): () => void {
  return startMirror("u1", {
    now: () => clock,
    onChanged,
    pull: {
      fetchPage: (query) => {
        queries.push(query);
        if (failing) return Promise.reject(new Error("the feed is down"));
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
  failing = false;
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

  // T-145: a restamped row already carries the stamp the pull brings, so its stamp says no news.
  it("says the mirror changed after a round that restamped rows, even when the pull replays them", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });

    await engine.options?.afterRound?.(false);
    expect(onChanged).toHaveBeenCalledOnce();

    await engine.options?.afterRound?.(true);
    expect(queries).toHaveLength(3);
    expect(onChanged).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps that news for the next pull when the one after the round fails", async () => {
    const stop = start();
    await vi.waitFor(() => {
      expect(onChanged).toHaveBeenCalledOnce();
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    failing = true;
    await engine.options?.afterRound?.(true);
    expect(onChanged).toHaveBeenCalledOnce();

    failing = false;
    await engine.options?.afterRound?.(false);
    expect(onChanged).toHaveBeenCalledTimes(2);
    warn.mockRestore();
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

  // T-164: before this, the page in flight landed after the purge and the copy kept only what followed.
  it("downloads everything again when the resync lands while a pull is paging", async () => {
    const asked: PullPageQuery[] = [];
    const answers: ((page: SyncChangesResponse) => void)[] = [];
    const pageOf = (ids: string[], hasMore: boolean, nextCursor: string): SyncChangesResponse => ({
      serverTime: feed.serverTime,
      changes: feedChanges({ accounts: ids.map((id) => account({ id })) }),
      pagination: { limit: 500, count: ids.length, hasMore, nextCursor },
    });
    const stop = startMirror("u1", {
      now: () => clock,
      pull: {
        fetchPage: (query) => {
          asked.push(query);
          return new Promise<SyncChangesResponse>((resolve) => answers.push(resolve));
        },
      },
    });
    await vi.waitFor(() => {
      expect(answers).toHaveLength(1);
    });
    answers[0]?.(pageOf(["a1"], true, "c1"));
    await vi.waitFor(() => {
      expect(answers).toHaveLength(2);
    });

    const resynced = forceFullResync("u1");
    await vi.waitFor(async () => {
      expect(await currentVault()?.db.count("accounts")).toBe(0);
    });
    answers[1]?.(pageOf(["a2"], true, "c2"));
    await vi.waitFor(() => {
      expect(answers).toHaveLength(3);
    });
    expect(asked[2]?.cursor).toBeUndefined();
    answers[2]?.(pageOf(["a1", "a2", "a3"], false, "v1|done|"));

    await expect(resynced).resolves.toBeUndefined();
    expect(await currentVault()?.db.count("accounts")).toBe(3);
    stop();
  });

  it("downloads again when another tab purges the copy during the resync's own pass", async () => {
    const asked: PullPageQuery[] = [];
    const answers: ((page: SyncChangesResponse) => void)[] = [];
    const pageOf = (ids: string[], hasMore: boolean, nextCursor: string): SyncChangesResponse => ({
      serverTime: feed.serverTime,
      changes: feedChanges({ accounts: ids.map((id) => account({ id })) }),
      pagination: { limit: 500, count: ids.length, hasMore, nextCursor },
    });
    const stop = startMirror("u1", {
      now: () => clock,
      pull: {
        fetchPage: (query) => {
          asked.push(query);
          return new Promise<SyncChangesResponse>((resolve) => answers.push(resolve));
        },
      },
    });
    await vi.waitFor(() => {
      expect(answers).toHaveLength(1);
    });
    answers[0]?.(pageOf(["a1"], false, "v1|first|"));
    await vi.waitFor(async () => {
      expect(await currentVault()?.db.count("accounts")).toBe(1);
    });

    const resynced = forceFullResync("u1");
    await vi.waitFor(() => {
      expect(answers).toHaveLength(2);
    });
    answers[1]?.(pageOf(["a1"], true, "c1"));
    await vi.waitFor(() => {
      expect(answers).toHaveLength(3);
    });
    await purgeVault("u1");
    answers[2]?.(pageOf(["a2"], false, "v1|cut|"));
    await vi.waitFor(() => {
      expect(answers).toHaveLength(4);
    });
    expect(asked[3]?.cursor).toBeUndefined();
    answers[3]?.(pageOf(["a1", "a2"], false, "v1|done|"));

    await expect(resynced).resolves.toBeUndefined();
    expect(await currentVault()?.db.count("accounts")).toBe(2);
    stop();
  });

  it("keeps the profile out of a copy emptied while the server was answering for it", async () => {
    let answerMe: (response: Response) => void = () => undefined;
    const me = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (answerMe = resolve)))
      .mockImplementation(() => Promise.resolve(meResponse()));
    vi.stubGlobal("fetch", me);
    const stop = start();
    await vi.waitFor(() => {
      expect(me).toHaveBeenCalledOnce();
    });

    await purgeVault("u1");
    answerMe(meResponse());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    failing = true;
    await expect(pullNow()).rejects.toThrow("the feed is down");

    expect(await currentVault()?.db.get("profile", PROFILE_KEY)).toBeUndefined();
    warn.mockRestore();
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

describe("another user signing in on this device (T-152)", () => {
  // jsdom refuses to set a `__Host-` cookie over http, so the read is stubbed instead.
  const marker = (userId: string) =>
    vi.spyOn(document, "cookie", "get").mockReturnValue(`__Host-session=${userId}.1000`);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stops pulling into the copy, and says so when asked for a pass", async () => {
    const cookie = marker("u1");
    const stop = start();
    await vi.waitFor(() => {
      expect(queries).toHaveLength(1);
    });

    cookie.mockReturnValue("__Host-session=u2.1000");
    clock += PULL_STALE_MS;
    window.dispatchEvent(new Event("focus"));
    reportOnline(false);
    reportOnline(true);
    await engine.options?.afterRound?.(false);

    await expect(pullNow()).rejects.toBeInstanceOf(SessionChangedError);
    expect(queries).toHaveLength(1);
    stop();
  });

  it("refuses the resync before it empties the copy", async () => {
    const cookie = marker("u1");
    const stop = start();
    await vi.waitFor(async () => {
      expect(await currentVault()?.db.get("accounts", "a1")).toBeDefined();
    });

    cookie.mockReturnValue("__Host-session=u2.1000");

    await expect(forceFullResync("u1")).rejects.toBeInstanceOf(SessionChangedError);
    expect(await currentVault()?.db.get("accounts", "a1")).toBeDefined();
    stop();
  });

  it("does not keep a profile the server answered for someone else", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({ user: { id: "u2", name: "Bea", timezone: "Europe/Madrid" } }),
          {
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    const stop = start();

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        "ledger-flow: the mirror could not fetch the profile it lacks",
        expect.any(SessionChangedError),
      );
    });
    expect(await currentVault()?.db.get("profile", PROFILE_KEY)).toBeUndefined();
    stop();
  });
});
