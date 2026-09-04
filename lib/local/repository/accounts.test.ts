import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, openTestVault, wipeVaults } from "@/lib/testing/vault";
import type { Account, AccountList, SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { readAccount, readAccounts } from "./accounts";
import { setCurrentVault } from "./read";

const cash = account({ id: "a1", name: "Cash", isDefault: true });
const bank = account({ id: "a2", name: "Bank", isDefault: false });
const old = account({ id: "a3", name: "Old card", archivedAt: "2026-08-20T00:00:00.000Z" });

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

function feedPage(accounts: Account[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: { user: null, accounts, categories: [], transactions: [], budgets: [] },
    pagination: { limit: 500, count: accounts.length, hasMore: false, nextCursor: "v1|done|" },
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  setCurrentVault(null);
  connectivityStore.reset();
  vi.unstubAllGlobals();
  await wipeVaults();
});

async function mirrorOf(accounts: Account[]): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(accounts)) });
  setCurrentVault(vault);
}

describe("accounts through the repository", () => {
  it("reads the server while online and the mirror while offline, with the same answer", async () => {
    const served: AccountList = {
      data: [cash, bank],
      pagination: { limit: 100, offset: 0, total: 2, hasMore: false, nextCursor: null },
    };
    fetchMock.mockResolvedValue(json(served));
    await mirrorOf([cash, bank, old]);

    const online = await readAccounts();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/accounts?limit=100");

    reportOnline(false);
    const offline = await readAccounts();

    expect(online).toEqual(served);
    expect(offline).toEqual(served);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("hands back the archived ones only when they were asked for", async () => {
    await mirrorOf([cash, bank, old]);
    reportOnline(false);

    await expect(readAccounts({ includeArchived: true })).resolves.toEqual({
      data: [cash, bank, old],
      pagination: { limit: 100, offset: 0, total: 3, hasMore: false, nextCursor: null },
    });
  });

  it("pages the mirror the way the API pages the list", async () => {
    await mirrorOf([cash, bank, old]);
    reportOnline(false);

    await expect(readAccounts({ includeArchived: true, limit: 2 })).resolves.toEqual({
      data: [cash, bank],
      pagination: { limit: 2, offset: 0, total: 3, hasMore: true, nextCursor: "a2" },
    });
  });

  it("reads one account from the mirror, archived included", async () => {
    await mirrorOf([cash, old]);
    reportOnline(false);

    await expect(readAccount("a3")).resolves.toEqual(old);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Nothing local to answer with: the server has to produce the real error, not the mirror a lie.
  it("asks the server for an account the mirror never saw", async () => {
    await mirrorOf([cash]);
    reportOnline(false);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(readAccount("a9")).rejects.toThrow("Network request failed");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
