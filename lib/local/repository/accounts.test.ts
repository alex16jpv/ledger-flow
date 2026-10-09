import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { account, changes as feedChanges, openTestVault, wipeVaults } from "@/lib/testing/vault";
import type { Account, AccountList, SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { readAccount, readAccounts, readAccountsPage } from "./accounts";
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
    changes: feedChanges({ accounts }),
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
  // O-F2b: with network too — the server serves only until the first pull has drained.
  it("asks the server until a pull has drained and reads the mirror from then on", async () => {
    const served: AccountList = {
      data: [cash, bank],
      pagination: { limit: 100, offset: 0, total: 2, hasMore: false, nextCursor: null },
    };
    fetchMock.mockResolvedValue(json(served));
    const vault = await openTestVault("u1");
    setCurrentVault(vault);

    const beforeSnapshot = await readAccounts();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/accounts?limit=100");

    await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage([cash, bank, old])) });
    fetchMock.mockClear();
    const online = await readAccounts();

    reportOnline(false);
    const offline = await readAccounts();

    expect(beforeSnapshot).toEqual(served.data);
    expect(online).toEqual(served.data);
    expect(offline).toEqual(served.data);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hands back the archived ones only when they were asked for", async () => {
    await mirrorOf([cash, bank, old]);
    reportOnline(false);

    await expect(readAccounts()).resolves.toEqual([cash, bank]);
    await expect(readAccounts({ includeArchived: true })).resolves.toEqual([cash, bank, old]);
  });

  // T-38: archived ones count towards a page, so past 100 the newest fell off every screen.
  it("hands back every account the mirror holds, past one page", async () => {
    const many = Array.from({ length: 130 }, (_, index) =>
      account({
        id: `a${String(index).padStart(3, "0")}`,
        name: `Account ${index}`,
        isDefault: index === 0,
        archivedAt: index < 40 ? "2026-08-20T00:00:00.000Z" : null,
      }),
    );
    await mirrorOf(many);
    reportOnline(false);

    await expect(readAccounts({ includeArchived: true })).resolves.toEqual(many);
    await expect(readAccounts()).resolves.toEqual(many.slice(40));
  });

  it("follows the server's cursor until the last page before the first pull", async () => {
    const pages: AccountList[] = [
      {
        data: [cash, bank],
        pagination: { limit: 100, offset: 0, total: 3, hasMore: true, nextCursor: "a2" },
      },
      {
        data: [old],
        pagination: { limit: 100, offset: 0, total: 3, hasMore: false, nextCursor: null },
      },
    ];
    fetchMock.mockResolvedValueOnce(json(pages[0])).mockResolvedValueOnce(json(pages[1]));
    setCurrentVault(await openTestVault("u1"));

    await expect(readAccounts({ includeArchived: true })).resolves.toEqual([cash, bank, old]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/accounts?includeArchived=true&limit=100",
      "/api/accounts?includeArchived=true&limit=100&cursor=a2",
    ]);
  });

  it("pages the mirror the way the API pages the list", async () => {
    await mirrorOf([cash, bank, old]);
    reportOnline(false);

    await expect(readAccountsPage({ includeArchived: true, limit: 2 })).resolves.toEqual({
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
