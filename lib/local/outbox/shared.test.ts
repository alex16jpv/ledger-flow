import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { answerBatch, operationsOf } from "@/lib/testing/sync";
import {
  openTestVault,
  profile,
  sharedExpense,
  sharedGroup,
  wipeVaults,
} from "@/lib/testing/vault";
import type { SharedSplit } from "@/types/api";

import { setCurrentVault } from "../repository/read";
import { profileRecord, sharedExpenseRecord, sharedGroupRecord } from "../schema";
import { pendingOperations } from "./queue";
import { createSharedExpense, createSharedGroup, saveSharedSplit } from "./shared";

const ANA = "k1";

const fetchMock = vi.fn<typeof fetch>();

const equal = (amount: number): SharedSplit => ({
  mode: "EQUAL",
  guests: null,
  shares: [
    {
      party: "USER",
      contactId: null,
      percent: null,
      fixedAmount: null,
      amount: amount / 2,
      collected: 0,
    },
    {
      party: "CONTACT",
      contactId: ANA,
      percent: null,
      fixedAmount: null,
      amount: amount / 2,
      collected: 0,
    },
  ],
});

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

async function vaultWith() {
  const vault = await openTestVault("u1");
  await vault.db.put("profile", profileRecord(profile()));
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-04T00:00:00.000Z" });
  setCurrentVault(vault);
  return vault;
}

describe("writing a shared group with no network", () => {
  it("projects the group with you in it, and queues the create", async () => {
    const vault = await vaultWith();
    reportOnline(false);

    const group = await createSharedGroup({
      name: "Night out",
      color: "TEAL",
      contactIds: [ANA],
      defaultSplit: { mode: "EQUAL", shares: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    // You are always a participant and are never named among the contacts sent.
    expect(group.participants.map((one) => one.contactId)).toEqual([null, ANA]);
    expect((await vault.db.get("sharedGroups", group.id))?.row.name).toBe("Night out");
    const [operation] = await pendingOperations(vault.db);
    expect(operation).toMatchObject({ entity: "sharedGroup", action: "create" });
  });

  it("sends no split when the expense inherits the group's, which is what tells the two apart", async () => {
    await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock);

    await createSharedExpense({
      row: {
        id: "e1",
        groupId: "g1",
        description: "Food",
        date: "2026-08-10T20:00:00.000Z",
        amount: 100_000,
        paidByContactId: null,
        split: equal(100_000),
        customSplit: false,
      },
      transactionId: "t1",
    });

    const sent = operationsOf(fetchMock.mock.calls[0]?.[1])[0];
    expect(sent).toMatchObject({
      entity: "sharedExpense",
      action: "create",
      payload: { params: { groupId: "g1" } },
    });
    expect(sent?.payload.body).toEqual({ id: "e1", transactionId: "t1" });
  });

  it("sends the split, without the figures it worked out, when the expense carries its own", async () => {
    await vaultWith();
    reportOnline(true);
    answerBatch(fetchMock);

    await createSharedExpense({
      row: {
        id: "e2",
        groupId: "g1",
        description: "Fuel",
        date: "2026-08-10T20:00:00.000Z",
        amount: 60_000,
        paidByContactId: null,
        split: equal(60_000),
        customSplit: true,
      },
    });

    const body = operationsOf(fetchMock.mock.calls[0]?.[1])[0]?.payload.body as {
      split: { shares: Record<string, unknown>[] };
    };
    expect(body.split.shares[0]).toEqual({
      party: "USER",
      contactId: null,
      percent: null,
      fixedAmount: null,
    });
  });

  it("hands an expense back to the group's default without typing a split", async () => {
    const vault = await vaultWith();
    await vault.db.put(
      "sharedGroups",
      sharedGroupRecord(sharedGroup({ id: "g1", name: "Night out" })),
    );
    await vault.db.put(
      "sharedExpenses",
      sharedExpenseRecord(
        sharedExpense({ id: "e1", groupId: "g1", amount: 100_000, customSplit: true }),
      ),
    );
    reportOnline(false);

    const saved = await saveSharedSplit({
      id: "e1",
      groupId: "g1",
      split: null,
      projected: equal(100_000),
    });

    expect(saved.customSplit).toBe(false);
    expect(saved.split.shares.map((one) => one.amount)).toEqual([50_000, 50_000]);
    const [operation] = await pendingOperations(vault.db);
    expect(operation?.payload).toMatchObject({ body: { useGroupSplit: true } });
  });
});
