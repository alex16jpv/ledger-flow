import type { SharedLedgerRows } from "@/lib/local/repository";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type { SharedGroup, SharedShare, SyncSharedGroup } from "@/types/api";

import { sectionOf } from "./ledger";
import { NOTHING_PENDING, partyPending, pendingIn, rowSync } from "./pending";

const ANA = "k1";
const BETO = "k2";
const CARLA = "k3";

const share = (over: Partial<SharedShare> & { amount: number }): SharedShare => ({
  party: "CONTACT",
  contactId: null,
  percent: null,
  fixedAmount: null,
  collected: 0,
  ...over,
});

const withTotals = (row: SyncSharedGroup): SharedGroup => ({
  ...row,
  status: "OPEN",
  totals: {
    amount: 0,
    yourShare: 0,
    owedToYou: 0,
    writtenOff: 0,
    youOwe: 0,
    collected: 0,
    expenseCount: 0,
    dateFrom: null,
    dateTo: null,
  },
});

const split = (amount: number, people: (string | null)[], guests = 0) => ({
  mode: "EQUAL" as const,
  guests: guests === 0 ? null : { count: guests, name: null },
  shares: [
    ...people.map((contactId) =>
      share({
        party: contactId === null ? "USER" : "CONTACT",
        contactId,
        amount: amount / (people.length + guests),
      }),
    ),
    ...(guests === 0
      ? []
      : [share({ party: "GUESTS", amount: (amount * guests) / (people.length + guests) })]),
  ],
});

const contacts = [
  contact({ id: ANA, name: "Ana Ruiz" }),
  contact({ id: BETO, name: "Beto Cano" }),
  contact({ id: CARLA, name: "Carla Díaz" }),
];

// Ana is only in Night out, Beto in both groups, and the trip has a block of guests.
function rows(over: Partial<SharedLedgerRows> = {}): SharedLedgerRows {
  return {
    groups: [
      withTotals(sharedGroup({ id: "g1", name: "Night out" })),
      withTotals(sharedGroup({ id: "g2", name: "Trip" })),
    ],
    expenses: [
      sharedExpense({
        id: "s1",
        groupId: "g1",
        amount: 90_000,
        split: split(90_000, [null, ANA, BETO]),
      }),
      sharedExpense({
        id: "s2",
        groupId: "g2",
        amount: 60_000,
        split: split(60_000, [null, BETO]),
      }),
      sharedExpense({ id: "s3", groupId: "g2", amount: 30_000, split: split(30_000, [null], 2) }),
    ],
    settlements: [],
    undone: [],
    ...over,
  };
}

const queue = (ids: string[], stuck: string[] = []) => ({
  queuedRows: new Set(ids),
  attentionRows: new Map(stuck.map((id, seq) => [id, seq])),
});

const fromBeto = settlement({
  id: "p1",
  counterparty: { kind: "CONTACT", contactId: BETO, expenseId: null },
  collected: 10_000,
});

describe("what a queued write marks in Shared", () => {
  it("marks nothing while the queue is empty", () => {
    expect(pendingIn(sectionOf(rows(), contacts), queue([]))).toBe(NOTHING_PENDING);
  });

  it("marks the person a payment is with, and every group shared with them", () => {
    const pending = pendingIn(
      sectionOf(rows({ settlements: [fromBeto] }), contacts),
      queue(["p1"]),
    );

    expect(pending.any).toBe(true);
    expect([...pending.people]).toEqual([BETO]);
    // A payment covers the oldest line first across every group, so both of Beto's move.
    expect([...pending.groups].sort()).toEqual(["g1", "g2"]);
    expect(partyPending(pending, "g1", `contact:${BETO}`)).toBe(true);
    expect(partyPending(pending, "g1", `contact:${ANA}`)).toBe(false);
    expect(partyPending(pending, "g1", null)).toBe(false);
    expect(pending.guests).toBe(false);
    expect(rowSync(pending, "p1")).toBe("pending");
  });

  it("marks a whole group, and everybody in it, when one of its expenses is queued", () => {
    const pending = pendingIn(sectionOf(rows(), contacts), queue(["s1"]));

    expect([...pending.people].sort()).toEqual([ANA, BETO]);
    expect(partyPending(pending, "g1", null)).toBe(true);
    expect(partyPending(pending, "g1", `contact:${ANA}`)).toBe(true);
    expect(rowSync(pending, "s1")).toBe("pending");
    expect(rowSync(pending, "s2")).toBeNull();
  });

  // An older expense takes Beto's payments first, so what they covered in the trip moves too.
  it("marks the other groups of everybody in it, whose payments it spreads again", () => {
    const pending = pendingIn(sectionOf(rows(), contacts), queue(["s1"]));

    expect([...pending.groups].sort()).toEqual(["g1", "g2"]);
    expect(partyPending(pending, "g2", `contact:${BETO}`)).toBe(true);
    expect(partyPending(pending, "g2", null)).toBe(false);
    expect(partyPending(pending, "g2", "guests:s3")).toBe(false);
    expect(pending.guests).toBe(false);
  });

  it("marks a group whose own change is queued", () => {
    const pending = pendingIn(sectionOf(rows(), contacts), queue(["g2"]));

    expect([...pending.groups].sort()).toEqual(["g1", "g2"]);
    expect(partyPending(pending, "g1", `contact:${ANA}`)).toBe(false);
    expect([...pending.people]).toEqual([BETO]);
    expect(pending.guests).toBe(true);
    expect(rowSync(pending, "g2")).toBe("pending");
  });

  it("finds the person of a payment undone here, which the section no longer lists", () => {
    const undone = { ...fromBeto, deletedAt: "2026-09-23T10:00:00.000Z" };
    const pending = pendingIn(sectionOf(rows({ undone: [undone] }), contacts), queue(["p1"]));

    expect([...pending.people]).toEqual([BETO]);
    expect([...pending.groups].sort()).toEqual(["g1", "g2"]);
  });

  it("marks the guests' line and their group, not the people, for a payment from a block", () => {
    const fromGuests = settlement({
      id: "p2",
      counterparty: { kind: "GUESTS", contactId: null, expenseId: "s3" },
      collected: 10_000,
    });
    const pending = pendingIn(
      sectionOf(rows({ settlements: [fromGuests] }), contacts),
      queue(["p2"]),
    );

    expect(pending.guests).toBe(true);
    expect([...pending.groups]).toEqual(["g2"]);
    expect(pending.people.size).toBe(0);
    expect(partyPending(pending, "g2", "guests:s3")).toBe(true);
  });

  it("gives a person added here a badge and no figure, since no money moved", () => {
    const pending = pendingIn(sectionOf(rows(), contacts), queue([CARLA]));

    expect(pending.any).toBe(false);
    expect(pending.people.size).toBe(0);
    expect(rowSync(pending, CARLA)).toBe("pending");
  });

  it("says a refused write needs attention rather than that it is waiting", () => {
    const pending = pendingIn(
      sectionOf(rows({ settlements: [fromBeto] }), contacts),
      queue(["p1"], ["p1"]),
    );

    expect(rowSync(pending, "p1")).toBe("attention");
  });
});
