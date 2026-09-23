import type { SharedLedgerRows } from "@/lib/local/repository";
import { contact, settlement, sharedExpense, sharedGroup } from "@/lib/testing/vault";
import type {
  AddParticipantsPreview,
  SharedGroup,
  SharedShare,
  SyncSharedGroup,
} from "@/types/api";

import { sectionOf } from "./ledger";
import { previewRows } from "./participants";

const ANA = "k1";
const BETO = "k2";
const DIEGO = "k3";

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

// You front 300,000 split three ways; Ana has paid hers, Beto's was given up on.
function trip(): SharedLedgerRows {
  return {
    groups: [
      withTotals(
        sharedGroup({
          id: "g1",
          name: "Cartagena trip",
          participants: [null, ANA, BETO].map((contactId) => ({
            contactId,
            addedAt: "2026-08-01T00:00:00.000Z",
          })),
          writeOffs: [
            {
              kind: "CONTACT",
              contactId: BETO,
              expenseId: null,
              amount: 100_000,
              at: "2026-09-01T00:00:00.000Z",
            },
          ],
        }),
      ),
    ],
    expenses: [
      sharedExpense({
        id: "s1",
        description: "Hotel",
        amount: 300_000,
        split: {
          mode: "EQUAL",
          guests: null,
          shares: [
            share({ party: "USER", contactId: null, amount: 100_000 }),
            share({ contactId: ANA, amount: 100_000 }),
            share({ contactId: BETO, amount: 100_000 }),
          ],
        },
      }),
    ],
    settlements: [
      settlement({
        id: "p1",
        counterparty: { kind: "CONTACT", contactId: ANA, expenseId: null },
        collected: 100_000,
      }),
    ],
    undone: [],
    dropped: [],
  };
}

// Four people instead of three: 75,000 each.
const preview: AddParticipantsPreview = {
  participants: [
    { contactId: null, shareBefore: 100_000, shareAfter: 75_000 },
    { contactId: ANA, shareBefore: 100_000, shareAfter: 75_000 },
    { contactId: BETO, shareBefore: 100_000, shareAfter: 75_000 },
    { contactId: DIEGO, shareBefore: 0, shareAfter: 75_000 },
  ],
  expenses: { total: 1, resplit: 1, untouched: 0 },
};

describe("what adding people would do", () => {
  const contacts = [
    contact({ id: ANA, name: "Ana Ruiz" }),
    contact({ id: BETO, name: "Beto Cano" }),
  ];
  const view = sectionOf(trip(), contacts).groups[0];
  if (!view) throw new Error("no group");
  const rows = previewRows(view, preview, [contact({ id: DIEGO, name: "Diego Pardo" })]);

  it("leaves somebody who paid their old share ahead of the new one", () => {
    expect(rows.find((row) => row.contactId === ANA)).toMatchObject({
      name: "Ana Ruiz",
      paid: 100_000,
      shareAfter: 75_000,
      ahead: 25_000,
      state: "PAID",
    });
  });

  // A share that falls takes the write-off down with it, and no figure of yours moves.
  it("takes the written-off amount down with the share", () => {
    expect(rows.find((row) => row.contactId === BETO)).toMatchObject({
      writtenOffBefore: 100_000,
      writtenOffAfter: 75_000,
      state: "WRITTEN_OFF",
    });
  });

  // The ceiling is what was open when you gave up, and a falling share never raises it.
  it("caps what a write-off becomes at the ceiling the decision stored", () => {
    const capped = previewRows(
      view,
      {
        participants: [{ contactId: BETO, shareBefore: 100_000, shareAfter: 90_000 }],
        expenses: { total: 1, resplit: 1, untouched: 0 },
      },
      [],
    );
    expect(capped[0]).toMatchObject({ writtenOffBefore: 100_000, writtenOffAfter: 90_000 });
  });

  it("does not read as paid somebody whose new share is nothing", () => {
    const untouched = previewRows(
      view,
      {
        participants: [{ contactId: DIEGO, shareBefore: 0, shareAfter: 0 }],
        expenses: { total: 1, resplit: 0, untouched: 1 },
      },
      [contact({ id: DIEGO, name: "Diego Pardo" })],
    );
    expect(untouched[0]).toMatchObject({ shareAfter: 0, state: "NOT_PAID" });
  });

  it("names somebody who is not in the group yet from what was picked", () => {
    expect(rows.find((row) => row.contactId === DIEGO)).toMatchObject({
      name: "Diego Pardo",
      paid: 0,
      shareAfter: 75_000,
      state: "NOT_PAID",
    });
  });

  it("reads your own row without a state, because you owe yourself nothing", () => {
    expect(rows[0]).toMatchObject({ contactId: null, shareAfter: 75_000 });
  });
});
