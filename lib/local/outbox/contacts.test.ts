import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, operationsOf } from "@/lib/testing/sync";
import { contact, openTestVault, profile, wipeVaults } from "@/lib/testing/vault";

import { setCurrentVault } from "../repository/read";
import { contactRecord, profileRecord } from "../schema";
import { archiveContact, createContact, restoreContact, updateContact } from "./contacts";
import { pendingOperations } from "./queue";

const fetchMock = vi.fn<typeof fetch>();
const ana = contact({ id: "c1", name: "Ana Ruiz", email: "ana@example.com" });

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

async function vaultWith(rows = [ana]) {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  for (const row of rows) await vault.db.put("contacts", contactRecord(row));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  setCurrentVault(vault);
  return vault;
}

describe("writing a contact through the outbox", () => {
  it("answers from the projection with no network, and leaves the operation queued", async () => {
    const vault = await vaultWith([]);
    reportOnline(false);

    const created = await createContact({ name: "Beto Cano", color: "TEAL" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(created).toMatchObject({
      name: "Beto Cano",
      color: "TEAL",
      archivedAt: null,
      userId: profile().id,
    });
    // The server answers an address it never got as absent, and a person is nobody's account.
    expect(created.email).toBeUndefined();
    const [operation] = await pendingOperations(vault.db);
    expect(operation).toMatchObject({ entity: "contact", action: "create", status: "pending" });
    expect(await vault.db.get("contacts", created.id)).toBeDefined();
  });

  it("takes the email out when the sheet clears it", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const saved = await updateContact("c1", { name: "Ana R.", email: null });

    expect(saved.name).toBe("Ana R.");
    expect(saved.email).toBeUndefined();
    expect((await vault.db.get("contacts", "c1"))?.row.email).toBeUndefined();
  });

  it("archives and restores the row in the copy while the queue holds the change", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    await archiveContact("c1");
    expect((await vault.db.get("contacts", "c1"))?.archived).toBe(1);

    await restoreContact("c1");
    expect((await vault.db.get("contacts", "c1"))?.archived).toBe(0);
    expect((await pendingOperations(vault.db)).map((one) => one.action)).toEqual([
      "archive",
      "restore",
    ]);
  });

  it("goes out as a contact operation of the batch", async () => {
    await vaultWith([]);
    reportOnline(true);
    answerBatch(fetchMock);

    const created = await createContact({ name: "Beto Cano" });

    const sent = operationsOf(fetchMock.mock.calls[0]?.[1])[0];
    expect(sent).toMatchObject({ entity: "contact", action: "create", id: created.id });
  });
});
