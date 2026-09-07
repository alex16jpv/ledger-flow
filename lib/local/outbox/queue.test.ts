import { openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";

import { profileRecord, transactionRecord } from "../schema";
import { dependenciesOf, type LocalWrite, pendingOperations, queueWrite, unsent } from "./queue";

const noUndo = () => Promise.resolve();

function write(overrides: Partial<LocalWrite> = {}): LocalWrite {
  return {
    entity: "transaction",
    entityId: "t1",
    action: "create",
    payload: { body: { amount: 20.29 } },
    project: async (tx) => {
      await tx.objectStore("transactions").put(transactionRecord(transaction({ id: "t1" })));
      return { dependsOn: [], undo: noUndo };
    },
    ...overrides,
  };
}

afterEach(wipeVaults);

describe("the outbox queue", () => {
  it("numbers operations from meta.outboxSeq, and the counter survives a reopen", async () => {
    const first = await openTestVault("u1");
    await queueWrite(first.db, write({ entityId: "t1" }));
    await queueWrite(first.db, write({ entityId: "t2" }));
    first.close();

    const again = await openTestVault("u1");
    const { operation } = await queueWrite(again.db, write({ entityId: "t3" }));

    expect(operation.seq).toBe(3);
    expect((await pendingOperations(again.db)).map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect((await again.db.get("meta", "outboxSeq"))?.value).toBe(3);
  });

  it("writes the envelope the plan defines, ordered by seq and never by the device clock", async () => {
    const vault = await openTestVault("u1");
    const clock = () => new Date("2026-09-04T10:00:00.000Z");
    const { operation } = await queueWrite(vault.db, write(), clock);

    expect(operation).toMatchObject({
      seq: 1,
      opVersion: 1,
      entity: "transaction",
      entityId: "t1",
      action: "create",
      occurredAt: "2026-09-04T10:00:00.000Z",
      dependsOn: [],
      status: "pending",
      attempts: 0,
      lastError: null,
    });
    expect(operation.opId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("writes the row and the operation together: if the projection fails, neither lands", async () => {
    const vault = await openTestVault("u1");
    const boom = write({
      project: async (tx) => {
        await tx.objectStore("transactions").put(transactionRecord(transaction({ id: "t1" })));
        throw new Error("no");
      },
    });

    await expect(queueWrite(vault.db, boom)).rejects.toThrow("no");
    expect(await vault.db.get("transactions", "t1")).toBeUndefined();
    expect(await vault.db.count("outbox")).toBe(0);
    expect(await vault.db.get("meta", "outboxSeq")).toBeUndefined();
  });

  it("writes the row and the operation together: if the queue refuses, the row goes back too", async () => {
    const vault = await openTestVault("u1");
    // A payload the structured clone algorithm refuses: the mirror row is already written when the
    // queue's own put fails, which is the half this item exists to make impossible.
    const unstorable = write({
      entityId: "t2",
      payload: { body: { amount: () => 1 } as unknown as Record<string, unknown> },
      project: async (tx) => {
        await tx.objectStore("transactions").put(transactionRecord(transaction({ id: "t2" })));
        return { dependsOn: [], undo: noUndo };
      },
    });

    await expect(queueWrite(vault.db, unstorable)).rejects.toThrow();

    expect(await vault.db.get("transactions", "t2")).toBeUndefined();
    expect(await vault.db.count("outbox")).toBe(0);
  });

  it("knows which ids the server has not seen, and declares only those", async () => {
    const vault = await openTestVault("u1");
    await vault.db.put("profile", profileRecord(profile()));
    await queueWrite(
      vault.db,
      write({
        entity: "account",
        entityId: "a-new",
        action: "create",
        project: () => Promise.resolve({ dependsOn: [], undo: noUndo }),
      }),
    );

    const tx = vault.db.transaction(["outbox", "meta"], "readwrite");
    expect(await unsent(tx, "account", "a-new")).toBe(true);
    expect(await unsent(tx, "account", "a1")).toBe(false);
    expect(
      await dependenciesOf(tx, [
        { entity: "account", id: "a-new" },
        { entity: "account", id: "a1" },
        { entity: "category", id: null },
      ]),
    ).toEqual(["a-new"]);
    await tx.done;
  });
});
