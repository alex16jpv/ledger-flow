import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { changes as feedChanges, contact, openTestVault, wipeVaults } from "@/lib/testing/vault";
import type { Contact, ContactList, SyncChangesResponse } from "@/types/api";

import { pullChanges } from "../pull";
import { readContact, readContacts, readContactsPage } from "./contacts";
import { setCurrentVault } from "./read";

const ana = contact({ id: "c1", name: "Ana Ruiz" });
const beto = contact({ id: "c2", name: "Beto Cano" });
const gone = contact({ id: "c3", name: "Lucía Mesa", archivedAt: "2026-08-20T00:00:00.000Z" });

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

function feedPage(contacts: Contact[]): SyncChangesResponse {
  return {
    serverTime: "2026-09-03T12:00:00.000Z",
    changes: feedChanges({ contacts }),
    pagination: { limit: 500, count: contacts.length, hasMore: false, nextCursor: "v1|done|" },
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

async function mirrorOf(contacts: Contact[]): Promise<void> {
  const vault = await openTestVault("u1");
  await pullChanges(vault, { fetchPage: () => Promise.resolve(feedPage(contacts)) });
  setCurrentVault(vault);
  reportOnline(false);
}

describe("contacts through the repository", () => {
  it("answers from the copy, with the archived ones only when they are asked for", async () => {
    await mirrorOf([ana, beto, gone]);

    expect((await readContacts()).map((row) => row.id)).toEqual(["c1", "c2"]);
    expect((await readContacts({ includeArchived: true })).map((row) => row.id)).toEqual([
      "c1",
      "c2",
      "c3",
    ]);
    expect((await readContact("c3")).name).toBe("Lucía Mesa");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Decision 12: the sheet that picks people pages, and it says how many of how many it shows.
  it("pages, and counts the whole list rather than what is left of it", async () => {
    await mirrorOf([ana, beto, gone]);

    const first = await readContactsPage({ limit: 1 });
    expect(first.data.map((row) => row.id)).toEqual(["c1"]);
    expect(first.pagination).toMatchObject({ total: 2, hasMore: true, nextCursor: "c1" });

    const second = await readContactsPage({ limit: 1, cursor: "c1" });
    expect(second.data.map((row) => row.id)).toEqual(["c2"]);
    expect(second.pagination).toMatchObject({ total: 2, hasMore: false, nextCursor: null });
  });

  // A cursor naming no row is a 400 on the server; the copy must not answer it as a first page.
  it("hands a cursor it cannot place over to the server", async () => {
    await mirrorOf([ana]);
    reportOnline(true);
    const served: ContactList = {
      data: [],
      pagination: { limit: 100, offset: 0, total: 0, hasMore: false, nextCursor: null },
    };
    fetchMock.mockImplementation(() => Promise.resolve(json(served)));

    await readContactsPage({ cursor: "nope" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/contacts?limit=100&cursor=nope");
  });

  it("drains the server's pages while the copy cannot answer", async () => {
    const page = (data: Contact[], nextCursor: string | null): ContactList => ({
      data,
      pagination: { limit: 100, offset: 0, total: 2, hasMore: nextCursor !== null, nextCursor },
    });
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(json(page([ana], "c1"))))
      .mockImplementationOnce(() => Promise.resolve(json(page([beto], null))));
    setCurrentVault(await openTestVault("u1"));

    expect((await readContacts()).map((row) => row.id)).toEqual(["c1", "c2"]);
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "/api/contacts?limit=100",
      "/api/contacts?limit=100&cursor=c1",
    ]);
  });
});
