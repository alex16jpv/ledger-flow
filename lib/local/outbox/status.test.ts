import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import type { OutboxEntity, OutboxOperation } from "../schema";
import { EMPTY_OUTBOX, outboxStatusStore, refreshOutboxStatus, resetOutboxStatus } from "./status";

function operation(seq: number, entity: OutboxEntity, action: string): OutboxOperation {
  return {
    seq,
    opId: `op-${seq}`,
    opVersion: 1,
    entity,
    entityId: `e${seq}`,
    action,
    occurredAt: "2026-09-04T10:00:00.000Z",
    payload: {},
    dependsOn: [],
    status: "pending",
    attempts: 0,
    lastError: null,
  };
}

async function statusOf(operations: OutboxOperation[]) {
  const vault = await openTestVault("u1");
  for (const entry of operations) await vault.db.put("outbox", entry);
  return refreshOutboxStatus(vault.db);
}

afterEach(async () => {
  resetOutboxStatus();
  await wipeVaults();
});

describe("what the queue says about the figures on screen", () => {
  it("marks nothing while it is empty", async () => {
    expect(await statusOf([])).toEqual(EMPTY_OUTBOX);
  });

  it("marks every money figure once a movement is queued", async () => {
    const status = await statusOf([operation(1, "transaction", "create")]);
    expect(status.projected).toEqual({ balances: true, spending: true, budgets: true });
  });

  it("marks only what the operation can move", async () => {
    expect((await statusOf([operation(1, "budget", "update")])).projected).toEqual({
      balances: false,
      spending: false,
      budgets: true,
    });
  });

  it("leaves the figures alone for a write that moves no money", async () => {
    expect((await statusOf([operation(1, "category", "update")])).projected).toEqual(
      EMPTY_OUTBOX.projected,
    );
  });

  it("keeps the same snapshot when nothing changed, so a screen does not re-render", async () => {
    await statusOf([operation(1, "transaction", "create")]);
    const first = outboxStatusStore.getSnapshot();
    const vault = await openTestVault("u1");
    expect(await refreshOutboxStatus(vault.db)).toBe(first);
  });
});
