import type { OutboxOperation } from "../schema";
import { coalesce } from "./coalesce";
import { operationPayload } from "./envelope";

function operation(
  seq: number,
  action: string,
  overrides: Partial<OutboxOperation> = {},
): OutboxOperation {
  return {
    seq,
    opId: `op-${seq}`,
    opVersion: 1,
    entity: "transaction",
    entityId: "t1",
    action,
    occurredAt: `2026-09-04T10:0${seq}:00.000Z`,
    payload: {},
    dependsOn: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

const money = (before: number | null, after: number | null) => ({
  effect: {
    before:
      before === null
        ? null
        : {
            type: "EXPENSE" as const,
            amount: before,
            fromAccountId: "a1",
            toAccountId: null,
            deletedAt: null,
          },
    after:
      after === null
        ? null
        : {
            type: "EXPENSE" as const,
            amount: after,
            fromAccountId: "a1",
            toAccountId: null,
            deletedAt: null,
          },
  },
});

describe("folding the queue before it is sent", () => {
  it("collapses ten edits of the same row into one request, at the place the first one held", () => {
    const edits = Array.from({ length: 10 }, (_, index) =>
      operation(index + 1, "update", { payload: { body: { amount: index + 1 } } }),
    );
    const plan = coalesce(edits);

    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]?.operation.seq).toBe(1);
    expect(plan.operations[0]?.absorbed).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(operationPayload(plan.operations[0]!.operation).body).toEqual({ amount: 10 });
  });

  it("keeps every field the run touched, not only the ones the last edit sent", () => {
    const plan = coalesce([
      operation(1, "update", { payload: { body: { amount: 10, description: "Bus" } } }),
      operation(2, "update", { payload: { body: { amount: 12 } } }),
    ]);

    expect(operationPayload(plan.operations[0]!.operation).body).toEqual({
      amount: 12,
      description: "Bus",
    });
  });

  it("keeps the FIRST before and the LAST after, which is what the balance projection needs", () => {
    const plan = coalesce([
      operation(1, "update", { payload: { ...money(20, 35) } }),
      operation(2, "update", { payload: { ...money(35, 50) } }),
    ]);

    const { effect } = operationPayload(plan.operations[0]!.operation);
    expect(effect?.before).toMatchObject({ amount: 20 });
    expect(effect?.after).toMatchObject({ amount: 50 });
  });

  it("guards the merged request with the updatedAt the FIRST operation knew", () => {
    const plan = coalesce([
      operation(1, "update", { baseUpdatedAt: "2026-08-01T00:00:00.000Z" }),
      operation(2, "update", { baseUpdatedAt: "2026-09-01T00:00:00.000Z" }),
    ]);

    expect(plan.operations[0]?.operation.baseUpdatedAt).toBe("2026-08-01T00:00:00.000Z");
  });

  it("never folds across an operation the server has already been asked about", () => {
    const plan = coalesce([
      operation(1, "update", { attempts: 1, payload: { body: { amount: 1 } } }),
      operation(2, "update", { payload: { body: { amount: 2 } } }),
      operation(3, "update", { payload: { body: { amount: 3 } } }),
    ]);

    expect(plan.operations.map((entry) => entry.operation.seq)).toEqual([1, 2]);
    expect(operationPayload(plan.operations[1]!.operation).body).toEqual({ amount: 3 });
  });

  it("leaves an operation waiting for the user alone, and does not fold what came after it", () => {
    const plan = coalesce([
      operation(1, "update", { status: "conflict", attempts: 1 }),
      operation(2, "update", { payload: { body: { amount: 2 } } }),
    ]);

    expect(plan.operations.map((entry) => entry.operation.status)).toEqual(["conflict", "pending"]);
  });

  it("sends nothing at all for a movement created and deleted before either left", () => {
    const plan = coalesce([
      operation(1, "create", { payload: { body: { id: "t1", amount: 10 } } }),
      operation(2, "update", { payload: { body: { amount: 12 } } }),
      operation(3, "delete"),
    ]);

    expect(plan.operations).toEqual([]);
    expect(plan.cancelled).toEqual([{ entity: "transaction", entityId: "t1", seqs: [1, 2, 3] }]);
  });

  it("still creates a movement that was deleted after the server was told about it", () => {
    const plan = coalesce([operation(1, "create", { attempts: 1 }), operation(2, "delete")]);

    expect(plan.cancelled).toEqual([]);
    expect(plan.operations.map((entry) => entry.operation.action)).toEqual(["create", "delete"]);
  });

  it("archiving is a state, not a removal: creating and archiving still reaches the server", () => {
    const account = { entity: "account" as const, entityId: "a9" };
    const plan = coalesce([operation(1, "create", account), operation(2, "archive", account)]);

    expect(plan.cancelled).toEqual([]);
    expect(plan.operations.map((entry) => entry.operation.action)).toEqual(["create", "archive"]);
  });

  it("folds an edit into the create that has not left yet", () => {
    const plan = coalesce([
      operation(1, "create", { payload: { body: { id: "t1", amount: 10 } } }),
      operation(2, "update", { payload: { body: { amount: 12 } } }),
    ]);

    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]?.operation.action).toBe("create");
    expect(operationPayload(plan.operations[0]!.operation).body).toEqual({ id: "t1", amount: 12 });
  });

  it("keeps two amounts written for different budget periods, and folds two for the same one", () => {
    const budget = { entity: "budget" as const, entityId: "b1" };
    const august = { query: { reference: "2026-08-01" }, body: { amount: 100 } };
    const september = { query: { reference: "2026-09-01" }, body: { amount: 200 } };

    expect(
      coalesce([
        operation(1, "setOverride", { ...budget, payload: august }),
        operation(2, "setOverride", { ...budget, payload: september }),
      ]).operations,
    ).toHaveLength(2);

    const same = coalesce([
      operation(1, "setOverride", { ...budget, payload: august }),
      operation(2, "setOverride", { ...budget, payload: { ...august, body: { amount: 150 } } }),
    ]);
    expect(same.operations).toHaveLength(1);
    expect(operationPayload(same.operations[0]!.operation).body).toEqual({ amount: 150 });
  });

  it("does not reorder: two rows edited in turn keep the order they were written in", () => {
    const plan = coalesce([
      operation(1, "update", { entityId: "t1" }),
      operation(2, "update", { entityId: "t2" }),
      operation(3, "update", { entityId: "t1" }),
    ]);

    expect(plan.operations.map((entry) => entry.operation.seq)).toEqual([1, 2]);
    expect(plan.operations[0]?.absorbed).toEqual([3]);
  });

  it("carries every dependency the folded operations declared", () => {
    const plan = coalesce([
      operation(1, "update", { dependsOn: ["a1"] }),
      operation(2, "update", { dependsOn: ["a1", "c9"] }),
    ]);

    expect(plan.operations[0]?.operation.dependsOn).toEqual(["a1", "c9"]);
  });
});
