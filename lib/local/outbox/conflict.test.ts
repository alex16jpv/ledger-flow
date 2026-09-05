import type { OutboxOperation } from "../schema";
import { conflictFields, conflictKind, serverStamp } from "./conflict";

function operation(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    seq: 1,
    opId: "op-1",
    opVersion: 1,
    entity: "transaction",
    entityId: "t1",
    action: "update",
    occurredAt: "2026-09-04T10:00:00.000Z",
    payload: {},
    dependsOn: [],
    status: "conflict",
    attempts: 1,
    lastError: "STALE_UPDATE",
    ...overrides,
  };
}

describe("the text/money classification of a conflict", () => {
  it("merges an edit that only carries text", () => {
    const body = { description: "Lunch", note: "with Ana", tags: ["food"] };
    expect(conflictKind(operation({ payload: { body } }))).toBe("text");
  });

  it("asks about anything that touches money", () => {
    expect(conflictKind(operation({ payload: { body: { amount: 1500 } } }))).toBe("structural");
    expect(
      conflictKind(operation({ payload: { body: { description: "Lunch", amount: 1500 } } })),
    ).toBe("structural");
  });

  it("asks about anything that touches structure", () => {
    for (const body of [
      { categoryId: "c1" },
      { fromAccountId: "a1" },
      { date: "2026-09-01T00:00:00.000Z" },
      { type: "INCOME" },
    ]) {
      expect(conflictKind(operation({ payload: { body } }))).toBe("structural");
    }
  });

  it("takes the name, the colour and the icon of the other entities as text too", () => {
    const body = { name: "Groceries", color: "GREEN", icon: "cart" };
    expect(conflictKind(operation({ entity: "category", payload: { body } }))).toBe("text");
  });

  it("never merges anything that is not an edit", () => {
    for (const action of ["create", "quickAdd", "delete", "archive", "restore", "setDefault"]) {
      expect(conflictKind(operation({ action, payload: { body: { name: "Wallet" } } }))).toBe(
        "structural",
      );
    }
  });

  it("asks when there is nothing to judge", () => {
    expect(conflictKind(operation({ payload: {} }))).toBe("structural");
    expect(conflictKind(operation({ payload: { body: {} } }))).toBe("structural");
    // A key the form did not send is not a field it changed.
    expect(conflictKind(operation({ payload: { body: { description: undefined } } }))).toBe(
      "structural",
    );
  });
});

describe("the two versions the sheet shows", () => {
  const current = {
    id: "t1",
    amount: 2000,
    description: "Dinner",
    tags: ["food"],
    updatedAt: "2026-09-04T12:00:00.000Z",
  };

  it("lines the fields the operation asked to change against the server's row", () => {
    const entry = operation({
      payload: { body: { id: "t1", amount: 1500, tags: ["food"] } },
      serverRow: current,
    });
    expect(conflictFields(entry, entry.serverRow)).toEqual([
      { name: "amount", mine: 1500, theirs: 2000, disputed: true },
      { name: "tags", mine: ["food"], theirs: ["food"], disputed: false },
    ]);
  });

  it("says a field is in dispute when the server does not have it at all", () => {
    const entry = operation({ payload: { body: { note: "later" } }, serverRow: current });
    expect(conflictFields(entry, entry.serverRow)).toEqual([
      { name: "note", mine: "later", theirs: undefined, disputed: true },
    ]);
  });

  it("has nothing to line up when the operation carries no body", () => {
    expect(conflictFields(operation({ action: "delete", payload: {} }), current)).toEqual([]);
  });

  it("reads the stamp a retry has to guard against, and only a real one", () => {
    expect(serverStamp(operation({ serverRow: current }))).toBe("2026-09-04T12:00:00.000Z");
    expect(serverStamp(operation({ serverRow: { id: "t1" } }))).toBeUndefined();
    expect(serverStamp(operation())).toBeUndefined();
  });
});
