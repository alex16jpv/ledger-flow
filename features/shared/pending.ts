import type { RowSync } from "@/components/ui/SyncBadge";
import { partyKey } from "@/lib/local/derive";
import type { OutboxStatus } from "@/lib/local/outbox";

import type { SharedSection } from "./ledger";

export interface SharedPending {
  any: boolean;
  guests: boolean;
  groups: ReadonlySet<string>;
  written: ReadonlySet<string>;
  // Payments are imputed oldest line first across every group, so these keys move in all of them.
  spread: ReadonlySet<string>;
  people: ReadonlySet<string>;
  queued: ReadonlySet<string>;
  attention: ReadonlyMap<string, number>;
}

type Queue = Pick<OutboxStatus, "queuedRows" | "attentionRows">;

const NONE: ReadonlySet<string> = new Set<string>();

export const NOTHING_PENDING: SharedPending = {
  any: false,
  guests: false,
  groups: NONE,
  written: NONE,
  spread: NONE,
  people: NONE,
  queued: NONE,
  attention: new Map<string, number>(),
};

const touches = (
  written: ReadonlySet<string>,
  spread: ReadonlySet<string>,
  groupId: string,
  key: string | null,
): boolean => written.has(groupId) || (key !== null && spread.has(key));

export const partyPending = (pending: SharedPending, groupId: string, key: string | null) =>
  touches(pending.written, pending.spread, groupId, key);

export function rowSync(pending: SharedPending, id: string): RowSync | null {
  if (pending.attention.has(id)) return "attention";
  return pending.queued.has(id) ? "pending" : null;
}

export function pendingIn(section: SharedSection, queue: Queue): SharedPending {
  if (queue.queuedRows.size === 0) return NOTHING_PENDING;
  const queued = queue.queuedRows;
  const written = new Set([
    ...section.groups
      .filter(
        (view) =>
          queued.has(view.group.id) || view.expenses.some((expense) => queued.has(expense.id)),
      )
      .map((view) => view.group.id),
    ...section.dropped.filter((expense) => queued.has(expense.id)).map((one) => one.groupId),
  ]);
  const spread = new Set(
    [...section.settlements, ...section.undone]
      .filter((one) => queued.has(one.id))
      .map((one) => partyKey(one.counterparty)),
  );
  for (const view of section.groups) {
    if (!written.has(view.group.id)) continue;
    for (const person of view.people) spread.add(person.key);
  }
  const groups = new Set(written);
  let guests = false;
  for (const view of section.groups) {
    for (const person of view.people) {
      if (!spread.has(person.key)) continue;
      groups.add(view.group.id);
      if (person.expenseId !== null) guests = true;
    }
  }
  const people = new Set(
    section.people
      .filter((person) => spread.has(partyKey({ contactId: person.contactId, expenseId: null })))
      .map((person) => person.contactId),
  );
  return {
    any: groups.size > 0 || people.size > 0,
    guests,
    groups,
    written,
    spread,
    people,
    queued,
    attention: queue.attentionRows,
  };
}
