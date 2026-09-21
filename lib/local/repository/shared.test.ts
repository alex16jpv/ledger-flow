import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
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
import { readSharedGroup, readSharedGroups } from "./shared";

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

describe("shared groups through the repository", () => {
  it("works the totals out on every read, the way the endpoint does", async () => {
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner],
      settlements: [anaPays],
    });

    const page = await readSharedGroups();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(page.data).toHaveLength(1);
    expect(page.data[0]?.totals).toEqual({
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
    expect(page.data[0]?.status).toBe("OPEN");
  });

  it("leaves an archived group out unless it is asked for, and answers one by id either way", async () => {
    await mirrorOf({ sharedGroups: [trip, closed] });

    expect((await readSharedGroups()).data.map((row) => row.id)).toEqual(["g1"]);
    expect((await readSharedGroups({ includeArchived: true })).data.map((row) => row.id)).toEqual([
      "g1",
      "g2",
    ]);
    expect((await readSharedGroup("g2")).name).toBe("Bogota");
  });

  it("reads SETTLED once nobody is left owing", async () => {
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner],
      settlements: [settlement({ id: "p1", counterparty: anaPays.counterparty, collected: 50000 })],
    });

    const page = await readSharedGroups();
    expect(page.data[0]?.status).toBe("SETTLED");
    expect(page.data[0]?.totals.owedToYou).toBe(0);
  });

  // O-F2b: the server serves only until the first pull has drained.
  it("asks the server while the mirror cannot answer", async () => {
    const served: SharedGroupList = {
      data: [],
      pagination: { limit: 50, offset: 0, total: 0, hasMore: false, nextCursor: null },
    };
    fetchMock.mockResolvedValue(json(served));
    setCurrentVault(await openTestVault("u1"));

    await readSharedGroups();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/shared-groups?limit=50");
  });

  it("forgets a group the feed deleted along with its expenses", async () => {
    await mirrorOf({
      sharedGroups: [trip],
      sharedExpenses: [dinner, { ...dinner, id: "s2", deletedAt: "2026-08-19T00:00:00.000Z" }],
      settlements: [anaPays],
    });

    // A deleted expense counts in no total, exactly as it leaves every other figure.
    expect((await readSharedGroups()).data[0]?.totals.amount).toBe(100000);
  });
});
