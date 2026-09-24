"use client";

import { HandCoins, Split, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Projected } from "@/components/ui/Projected";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { StateBadge } from "@/features/shared/components/parts";
import { useDeleteSettlement, useSharedPending } from "@/features/shared/hooks";
import type { GroupView, PartyView, SharedSection } from "@/features/shared/ledger";
import { partyPending } from "@/features/shared/pending";
import { presentError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type { PersonState } from "@/lib/local/derive";
import { fromCents, toCents } from "@/lib/local/derive/money";
import { countsAsYours as countsAsYoursOf } from "@/lib/local/derive/shared";
import type { Settlement, SharedExpense, SharedHistoryEntry, Transaction } from "@/types/api";

import { PaymentRows } from "../../shared/PaymentRows";
import { UndoPaymentSheet } from "../../shared/UndoPaymentSheet";

const EditSplitSheet = dynamic(() =>
  import("../../shared/EditSplitSheet").then((module) => module.EditSplitSheet),
);
const SettleUpFlow = dynamic(() =>
  import("../../shared/SettleUpFlow").then((module) => module.SettleUpFlow),
);

export interface SharedExpenseCardProps {
  row: Transaction;
  section: SharedSection;
  view: GroupView;
  expense: SharedExpense;
  categoryName?: string;
}

interface ShareRow {
  key: string;
  name: string;
  color: PartyView["color"];
  guests: boolean;
  share: number;
  paid: number;
  writtenOffAt: string | null;
  state: PersonState;
}

const expenseKeyOf = (person: PartyView | undefined): string | null => person?.expenseId ?? null;

const stateOf = (person: PartyView | undefined, paid: number, share: number): PersonState => {
  if (person?.state === "WRITTEN_OFF" && paid < share) return "WRITTEN_OFF";
  if (paid >= share) return "PAID";
  return paid > 0 ? "PARTIALLY_PAID" : "NOT_PAID";
};

// A participant reads `Paid` here and `Partially paid` in the group: oldest expense first.
function sharesOf(section: SharedSection, view: GroupView, expense: SharedExpense): ShareRow[] {
  const rows: ShareRow[] = [];
  for (const share of expense.split.shares) {
    if (share.party === "USER") continue;
    const key =
      share.party === "GUESTS" ? `guests:${expense.id}` : `contact:${share.contactId ?? ""}`;
    const person = view.people.find((one) => one.key === key);
    const paid = section.collected.get(`${expense.id}|${key}`) ?? 0;
    rows.push({
      key,
      name: person?.name ?? "",
      color: person?.color ?? null,
      guests: share.party === "GUESTS",
      share: share.amount,
      paid,
      writtenOffAt:
        view.group.writeOffs.find(
          (one) =>
            one.contactId === (person?.contactId ?? null) && one.expenseId === expenseKeyOf(person),
        )?.at ?? null,
      state: stateOf(person, toCents(paid), toCents(share.amount)),
    });
  }
  return rows;
}

export function owingParties(
  section: SharedSection,
  view: GroupView,
  expense: SharedExpense,
): PartyView[] {
  const keys = new Set(sharesOf(section, view, expense).map((one) => one.key));
  return view.people.filter(
    (person) =>
      keys.has(person.key) && (person.owesYou > 0 || person.youOwe > 0 || person.surplus > 0),
  );
}

function History({ entries, amount }: { entries: readonly SharedHistoryEntry[]; amount: number }) {
  const t = useTranslations("transactions.detail.shared");
  const dates = useDates();
  // An event that moved nothing says so, which is the whole point of keeping the list.
  const moved = entries.map(
    (entry, index) =>
      toCents(entry.countsAsYours) !== toCents(entries[index - 1]?.countsAsYours ?? amount),
  );
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-md font-semibold">{t("history")}</h3>
        <span className="text-sm text-text-3">{t("entries", { count: entries.length })}</span>
      </div>
      {entries.map((entry, index) => (
        <div
          key={`${entry.at}-${String(index)}`}
          className="flex items-start justify-between gap-4 border-t border-border pt-2 text-sm"
        >
          <span className="flex min-w-0 gap-2">
            <span className="shrink-0 pt-px text-xs text-text-3">
              {dates.formatDay(new Date(entry.at))}
            </span>
            <span>{t(`reasons.${entry.reason}`)}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <Amount value={entry.countsAsYours} signed={false} size="sm" />
            {!moved[index] && <span className="text-xs text-text-3">{t("noChange")}</span>}
          </span>
        </div>
      ))}
      <p className="pt-1 text-xs text-text-3">{t("historyNote")}</p>
    </Card>
  );
}

export function SharedExpenseCard({
  row,
  section,
  view,
  expense,
  categoryName,
}: SharedExpenseCardProps) {
  const t = useTranslations("transactions.detail.shared");
  const whole = useTranslations();
  const money = useMoney();
  const dates = useDates();
  const [editing, setEditing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [undoing, setUndoing] = useState<Settlement | null>(null);
  const undoPayment = useDeleteSettlement();
  const pending = useSharedPending(section);
  const toast = useToast();
  const yours = expense.split.shares.find((share) => share.party === "USER")?.amount ?? 0;
  const countsAsYours = countsAsYoursOf(row, section);
  const shares = sharesOf(section, view, expense);
  const owing = owingParties(section, view, expense);
  const openCents = shares
    .filter((one) => one.state === "NOT_PAID" || one.state === "PARTIALLY_PAID")
    .reduce((cents, one) => cents + toCents(one.share) - toCents(one.paid), 0);
  const writtenOffCents = shares
    .filter((one) => one.state === "WRITTEN_OFF")
    .reduce((cents, one) => cents + toCents(one.share) - toCents(one.paid), 0);

  // A block of guests lives in this expense alone, so this is the only place its payments are read.
  const guestPayments = section.settlements.filter(
    (one) => one.counterparty.expenseId === expense.id,
  );
  const guestName = shares.find((one) => one.guests)?.name ?? "";

  async function confirmUndo(settlement: Settlement) {
    try {
      await undoPayment.mutateAsync(settlement.id);
      setUndoing(null);
      toast.show({ message: whole("shared.undoPayment.done") });
    } catch (error) {
      setUndoing(null);
      toast.show({ message: whole(presentError(error, true).messageKey), tone: "danger" });
    }
  }

  const noteOf = (one: ShareRow): string => {
    if (one.state === "WRITTEN_OFF" && one.writtenOffAt) {
      return t("writtenOffOn", { date: dates.formatDay(new Date(one.writtenOffAt)) });
    }
    if (one.state === "PAID") return t("paidAll");
    if (one.state === "PARTIALLY_PAID") return t("paidSome", { amount: money.format(one.paid) });
    return t("neverPaid");
  };

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="flex min-w-0 items-center gap-2 text-md font-semibold">
            <Tile size="sm" color={view.group.color}>
              <Users {...iconProps("sm")} />
            </Tile>
            <span className="truncate">{view.group.name}</span>
          </h3>
          <Link
            href={`/shared/groups/${view.group.id}`}
            className="shrink-0 text-sm font-medium text-brand-text"
          >
            {t("openGroup")}
          </Link>
        </div>
        <Projected when={pending.groups.has(view.group.id) || pending.queued.has(row.id)}>
          <Amount value={countsAsYours} signed={false} size="lg" />
        </Projected>
        <span className="text-sm text-text-3">
          {writtenOffCents > 0
            ? t("leadWithWriteOff", {
                share: money.format(yours),
                owed: money.format(fromCents(openCents)),
                writtenOff: money.format(fromCents(writtenOffCents)),
              })
            : openCents > 0
              ? t("lead", { share: money.format(yours), owed: money.format(fromCents(openCents)) })
              : t("leadSettled", { share: money.format(yours) })}
        </span>
        <List>
          {/* You are a row like everybody else, with a share of your own. */}
          <Row>
            <Avatar name={t("you")} />
            <RowBody>
              <RowTitle>
                <span>{t("you")}</span>
              </RowTitle>
              <RowMeta
                items={[categoryName, dates.formatMonth(new Date(row.date))].filter(Boolean)}
              />
            </RowBody>
            <RowRight sub={t("yoursSub")}>
              <Projected when={partyPending(pending, view.group.id, null)}>
                <Amount value={yours} signed={false} />
              </Projected>
            </RowRight>
          </Row>
          {shares.map((one) => (
            <Row key={one.key}>
              {one.guests ? (
                <Tile color="GRAY">
                  <Users {...iconProps("md")} />
                </Tile>
              ) : (
                <Avatar name={one.name} color={one.color} />
              )}
              <RowBody>
                <RowTitle>
                  <span>{one.name}</span>
                  <StateBadge state={one.state} />
                </RowTitle>
                <RowMeta items={[noteOf(one)]} />
              </RowBody>
              <RowRight sub={t("ofShare", { amount: money.format(one.share) })}>
                <Projected when={partyPending(pending, view.group.id, one.key)}>
                  <Amount value={one.paid} signed={false} />
                </Projected>
              </RowRight>
            </Row>
          ))}
        </List>
        {guestPayments.length > 0 && (
          <>
            <h4 className="px-1 pt-1 text-sm font-semibold">{t("guestPayments")}</h4>
            <List>
              <PaymentRows rows={guestPayments} pending={pending} onUndo={setUndoing} />
            </List>
          </>
        )}
        {undoing && (
          <UndoPaymentSheet
            open
            settlement={undoing}
            name={guestName}
            pending={undoPayment.isPending}
            onClose={() => {
              setUndoing(null);
            }}
            onConfirm={() => {
              void confirmUndo(undoing);
            }}
          />
        )}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setEditing(true);
            }}
          >
            <Split {...iconProps("sm")} />
            {t("editSplit")}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={owing.length === 0}
            onClick={() => {
              setSettling(true);
            }}
          >
            <HandCoins {...iconProps("sm")} />
            {t("settleUp")}
          </Button>
        </div>
        {editing && (
          <EditSplitSheet
            group={view.group}
            expense={expense}
            open
            onClose={() => {
              setEditing(false);
            }}
          />
        )}
        {settling && (
          <SettleUpFlow
            section={section}
            view={view}
            parties={owing}
            open
            onClose={() => {
              setSettling(false);
            }}
          />
        )}
      </Card>
      {row.sharedHistory.length > 0 && <History entries={row.sharedHistory} amount={row.amount} />}
    </>
  );
}

export interface DeleteImpactRow {
  key: string;
  name: string;
  paid: number;
  wouldOwe: number;
}

export interface DeleteImpact {
  cost: number;
  arrived: number;
  rows: DeleteImpactRow[];
}

// Deleting it takes its shares away and nothing else: no payment moves, so everybody may end ahead.
export function deleteImpact(
  section: SharedSection,
  view: GroupView,
  expense: SharedExpense,
): DeleteImpact {
  const rows = new Map<string, { name: string; owed: number; paid: number }>();
  let cost = 0;
  let arrived = 0;
  for (const one of view.expenses) {
    if (one.id === expense.id) continue;
    cost += toCents(one.amount);
  }
  for (const one of view.expenses) {
    for (const share of one.split.shares) {
      if (share.party === "USER") continue;
      const key =
        share.party === "GUESTS" ? `guests:${one.id}` : `contact:${share.contactId ?? ""}`;
      const person = view.people.find((party) => party.key === key);
      const held = rows.get(key) ?? { name: person?.name ?? "", owed: 0, paid: 0 };
      if (one.id !== expense.id) held.owed += toCents(share.amount);
      held.paid += toCents(section.collected.get(`${one.id}|${key}`) ?? 0);
      rows.set(key, held);
    }
  }
  for (const held of rows.values()) arrived += held.paid;
  return {
    cost: fromCents(cost),
    arrived: fromCents(arrived),
    rows: [...rows].map(([key, held]) => ({
      key,
      name: held.name,
      paid: fromCents(held.paid),
      wouldOwe: fromCents(held.owed),
    })),
  };
}
