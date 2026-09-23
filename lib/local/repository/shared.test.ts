import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { urlOf } from "@/lib/testing/http";
import {
  changes as feedChanges,
  openTestVault,
  settlement,
  sharedExpense,
  sharedGroup,
  wipeVaults,
} from "@/lib/testing/vault";
import type {
  Contact,
  Settlement,
  SharedExpense,
  SharedGroupList,
  SyncChangesResponse,
  SyncSharedGroup,
} from "@/types/api";

import { pullChanges } from "../pull";
import { setCurrentVault } from "./read";
import { readSharedLedger } from "./shared";

const ANA = "01930005-0000-7000-8000-0000000k0001";

const trip = sharedGroup({ id: "g1", name: "Cartagena" });
const closed = sharedGroup({ id: "g2", name: "Bogota", archivedAt: "2026-08-20T00:00:00.000Z" });

// You fronted 100,000 of a dinner split with Ana, and she has paid 20,000 of her half.
const dinner = sharedExpense({
  id: "s1",
  groupId: "g1",
  amount: 100000,
  split: {
    mode: "EQUAL",
    guests: null,
    shares: [
      {
        party: "USER",
        contactId: null,
        percent: null,
        fixedAmount: null,
        amount: 50000,
        collected: 0,
      },
      {
        party: "CONTACT",
        contactId: ANA,
        percent: null,
        fixedAmount: null,
        amount: 50000,
        collected: 20000,
      },
    ],
  },
});

const anaPays = settlement({
  id: "p1",
  counterparty: { kind: "CONTACT", contactId: ANA, expenseId: null },
  collected: 20000,
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

interface Seed {
  contacts?: Contact[];
  sharedGroups?: SyncSharedGroup[];
  sharedExpenses?: SharedExpense[];
  settlements?: Settlement[];
}

function feedPage(seed: Seed): SyncChangesResponse {
  const rows = feedChanges(seed);
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: rows,
    pagination: { limit: 500, count: 1, hasMore: false, nextCursor: "v1|done|" },
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

async function mirrorOf(seed: Seed): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(seed)) });
  setCurrentVault(vault);
  reportOnline(false);
}

describe("the shared ledger through the repository", () => {
  it("works the totals out on every read, the way the endpoint does", async () => {
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner],
      settlements: [anaPays],
    });

    const rows = await readSharedLedger();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows.groups).toHaveLength(1);
    expect(rows.groups[0]?.totals).toEqual({
      amount: 100000,
      yourShare: 50000,
      owedToYou: 30000,
      writtenOff: 0,
      youOwe: 0,
      collected: 20000,
      expenseCount: 1,
      dateFrom: dinner.date,
      dateTo: dinner.date,
    });
    expect(rows.groups[0]?.status).toBe("OPEN");
  });

  // Archived groups fold away on the screen, so the section reads them and never asks twice.
  it("brings the archived groups too", async () => {
    await mirrorOf({ sharedGroups: [trip, closed] });

    expect((await readSharedLedger()).groups.map((row) => row.id)).toEqual(["g1", "g2"]);
  });

  it("reads SETTLED once nobody is left owing", async () => {
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner],
      settlements: [settlement({ id: "p1", counterparty: anaPays.counterparty, collected: 50000 })],
    });

    const rows = await readSharedLedger();
    expect(rows.groups[0]?.status).toBe("SETTLED");
    expect(rows.groups[0]?.totals.owedToYou).toBe(0);
  });

  // O-F2b: the server serves only until the first pull has drained.
  it("asks the server while the mirror cannot answer, and takes every group with it", async () => {
    const served: SharedGroupList = {
      data: [],
      pagination: { limit: 100, offset: 0, total: 0, hasMore: false, nextCursor: null },
    };
    fetchMock.mockImplementation(() => Promise.resolve(json(served)));
    setCurrentVault(await openTestVault("u1"));

    await readSharedLedger();
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/shared-groups?includeArchived=true&limit=100",
      "/api/settlements?limit=100",
    ]);
  });

  it("follows the cursor of every list, and asks each group for its own expenses", async () => {
    const page = (data: unknown[], nextCursor: string | null) =>
      json({
        data,
        pagination: {
          limit: 100,
          offset: 0,
          total: data.length,
          hasMore: nextCursor !== null,
          nextCursor,
        },
      });
    fetchMock.mockImplementation((input) => {
      const url = urlOf(input);
      if (url.includes("cursor=g1")) return Promise.resolve(page([{ ...trip, id: "g2" }], null));
      if (url.startsWith("/api/shared-groups?")) return Promise.resolve(page([trip], "g1"));
      if (url.includes("/g1/expenses")) return Promise.resolve(page([dinner], null));
      return Promise.resolve(page([], null));
    });
    setCurrentVault(await openTestVault("u1"));

    const rows = await readSharedLedger();

    expect(rows.groups.map((row) => row.id)).toEqual(["g1", "g2"]);
    expect(rows.expenses.map((row) => row.id)).toEqual(["s1"]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/shared-groups?includeArchived=true&limit=100",
      "/api/shared-groups?includeArchived=true&limit=100&cursor=g1",
      "/api/shared-groups/g1/expenses?limit=100",
      "/api/shared-groups/g2/expenses?limit=100",
      "/api/settlements?limit=100",
    ]);
  });

  // §6: a cursor that does not move is a server that would page for ever.
  it("stops rather than paging for ever on a cursor that does not move", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({
          data: [trip],
          pagination: { limit: 100, offset: 0, total: 1, hasMore: true, nextCursor: "same" },
        }),
      ),
    );
    setCurrentVault(await openTestVault("u1"));

    await expect(readSharedLedger()).rejects.toThrow(/kept paging/);
  });

  it("leaves an expense the feed deleted out of the group's totals", async () => {
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner, { ...dinner, id: "s2", deletedAt: "2026-08-19T00:00:00.000Z" }],
      settlements: [anaPays],
    });

    // A deleted expense counts in no total, exactly as it leaves every other figure.
    const rows = await readSharedLedger();
    expect(rows.groups[0]?.totals.amount).toBe(100000);
    expect(rows.expenses.map((row) => row.id)).toEqual(["s1"]);
  });

  // T-140: a queued undo names only the payment, and this is where its person is found.
  it("hands back the payments that were undone, apart from the live ones", async () => {
    const undone = { ...anaPays, id: "p2", deletedAt: "2026-08-20T00:00:00.000Z" };
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner],
      settlements: [anaPays, undone],
    });

    const rows = await readSharedLedger();
    expect(rows.settlements.map((row) => row.id)).toEqual([anaPays.id]);
    expect(rows.undone).toEqual([undone]);
  });
});
