import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { openVault, VAULT } from "./db";
import { vaultDatabaseName } from "./schema";

afterEach(wipeVaults);

describe("vault transactions (T-267)", () => {
  it("leaves no unhandled rejection behind a transaction nobody awaited", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const vault = await openTestVault("u1");

    vault.db.transaction("meta", "readwrite").abort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("still rejects the transaction for whoever awaits it", async () => {
    const vault = await openTestVault("u1");
    const tx = vault.db.transaction("meta", "readwrite");

    tx.abort();

    await expect(tx.done).rejects.toThrow("AbortError");
  });
});

describe("another tab asking for the vault (F-14, T-166)", () => {
  const settle = (request: IDBRequest): Promise<void> =>
    new Promise<void>((resolve) => {
      request.onsuccess = () => {
        if (request.result instanceof IDBDatabase) request.result.close();
        resolve();
      };
    });

  it("reports an upgrade as a close, so the mirror opens it again", async () => {
    const onClosed = vi.fn();
    const onDeleted = vi.fn();
    await openVault("u1", VAULT, { onClosed, onDeleted });

    await settle(indexedDB.open(vaultDatabaseName("u1"), VAULT.schemaVersion + 1));

    expect(onClosed).toHaveBeenCalledOnce();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("reports a delete as a delete, so nobody opens it again", async () => {
    const onClosed = vi.fn();
    const onDeleted = vi.fn();
    await openVault("u1", VAULT, { onClosed, onDeleted });

    await settle(indexedDB.deleteDatabase(vaultDatabaseName("u1")));

    expect(onDeleted).toHaveBeenCalledOnce();
    expect(onClosed).not.toHaveBeenCalled();
  });
});
