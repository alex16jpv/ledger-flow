"use client";

import { Calendar, Plus, Receipt, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { PageHeader } from "@/components/shell/PageHeader";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Progress } from "@/components/ui/Progress";
import { List, Row, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { useGroupRange } from "@/features/shared/components/GroupRowLink";
import { StateBadge } from "@/features/shared/components/parts";
import { type SplitPerson, SplitSheet } from "@/features/shared/components/SplitSheet";
import {
  useContactsQuery,
  useCreateSharedExpense,
  useSaveSharedSplit,
  useSharedSection,
} from "@/features/shared/hooks";
import { type GroupView, groupView, type PartyView } from "@/features/shared/ledger";
import { draftFromGroup, expenseFromTransaction, inheritedSplit } from "@/features/shared/write";
import { presentError } from "@/lib/api/errors";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";
import { featureColorStyle } from "@/lib/theme/feature-color";
import type { SharedExpense, SharedGroup, SharedSplit, Transaction } from "@/types/api";

import { TransactionPickerSheet } from "../../TransactionPickerSheet";
import { WhatChangesSheet } from "../../WhatChangesSheet";

// What a row says about somebody, which is the same thing the figures beside it are saying.
function useNoteOf(view: GroupView): (person: PartyView) => string {
  const t = useTranslations("shared.group.notes");
  const money = useMoney();
  const dates = useDates();
  const writeOffs = new Map(
    view.group.writeOffs.map((one) => [
      one.expenseId ? `guests:${one.expenseId}` : `contact:${one.contactId}`,
      one,
    ]),
  );
  return (person) => {
    const off = writeOffs.get(person.key);
    if (off) {
      return t("writtenOff", {
        amount: money.format(off.amount),
        date: dates.formatDay(new Date(off.at)),
      });
    }
    if (person.surplus > 0) return t("ahead", { amount: money.format(person.surplus) });
    if (person.youOwe > 0 && person.owesYou > 0) {
      return t("bothWays", {
        owed: money.format(person.owesYou),
        owe: money.format(person.youOwe),
      });
    }
    if (person.youOwe > 0) return t("youOwe", { amount: money.format(person.youOwe) });
    if (person.owesYou === 0) return t("paid");
    if (person.paid > 0) {
      return t("partly", {
        paid: money.format(person.paid),
        open: money.format(person.owesYou),
      });
    }
    return t("notPaid", { amount: money.format(person.owesYou) });
  };
}

function PartyRow({ person, note }: { person: PartyView; note: string }) {
  const t = useTranslations("shared.group");
  return (
    <Row>
      {person.expenseId === null ? (
        <Avatar name={person.name} color={person.color} />
      ) : (
        <Tile color="GRAY">
          <Users {...iconProps("md")} />
        </Tile>
      )}
      <RowBody>
        <RowTitle>
          <span>{person.name}</span>
          <StateBadge state={person.state} />
        </RowTitle>
        <RowMeta items={[note]} />
      </RowBody>
      <RowRight sub={t("share")}>
        <Amount value={person.share} signed={false} />
      </RowRight>
    </Row>
  );
}

function ExpenseRow({
  expense,
  payer,
  onSplit,
}: {
  expense: SharedExpense;
  payer: string;
  onSplit: () => void;
}) {
  const t = useTranslations("shared.group");
  const money = useMoney();
  const dates = useDates();
  const yours = expense.split.shares.find((share) => share.party === "USER")?.amount ?? 0;
  const mine = expense.paidByContactId === null;
  return (
    <RowButton onClick={onSplit}>
      <Tile color={mine ? null : "GRAY"}>
        <Receipt {...iconProps("md")} />
      </Tile>
      <RowBody>
        <RowTitle>
          <span>{expense.description ?? t("noDescription")}</span>
          {!mine && <Badge>{t("paidBy", { name: payer })}</Badge>}
          {expense.customSplit && <Badge>{t("customSplit")}</Badge>}
        </RowTitle>
        <RowMeta
          items={[
            dates.formatDay(new Date(expense.date)),
            // Somebody else's line is not a movement of yours until you settle with them.
            mine ? t("youPaid") : t("notInYourLedger"),
          ]}
        />
      </RowBody>
      <RowRight sub={t("yourShare", { amount: money.format(yours) })}>
        <Amount value={expense.amount} kind={mine ? "expense" : "settlement"} signed={false} />
      </RowRight>
    </RowButton>
  );
}

function GroupHero({ view }: { view: GroupView }) {
  const t = useTranslations();
  const money = useMoney();
  const range = useGroupRange();
  const { group } = view;
  return (
    <Card
      className="relative flex flex-col gap-1.5 overflow-hidden"
      style={featureColorStyle(group.color)}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-(--f)" />
      <div className="flex items-start justify-between gap-3">
        <Tile color={group.color}>
          <Users {...iconProps("md")} />
        </Tile>
        {group.totals.dateFrom && (
          <Badge tone="outline">
            <Calendar {...iconProps("sm")} />
            {range(group.totals.dateFrom, group.totals.dateTo)}
          </Badge>
        )}
      </div>
      <span className="pt-1.5 text-xs font-medium tracking-caps text-text-3 uppercase">
        {t("shared.groups.people", { count: group.participants.length })}
        {" · "}
        {t(`shared.group.status.${group.status}`)}
      </span>
      <h2 className="text-xl font-semibold tracking-[-0.02em]">{group.name}</h2>
      {/* The lead figure is neither what it cost nor what is fairly yours: it is what is left. */}
      <Amount value={view.countsAsYours} signed={false} size="hero" />
      <span className="text-sm text-text-3">
        {t("shared.group.lead", {
          total: money.format(group.totals.amount),
          share: money.format(group.totals.yourShare),
        })}
      </span>
      {view.barTotal > 0 && (
        <div className="flex flex-col gap-1 pt-2.5">
          <Progress
            thin
            plain
            value={view.collected}
            max={view.barTotal}
            color={group.color}
            label={t("shared.groups.barLabel", { name: group.name })}
          />
          <span className="text-xs text-text-3">
            {t("shared.groups.bar", {
              paid: money.format(view.collected),
              total: money.format(view.barTotal),
            })}
          </span>
        </div>
      )}
      {(view.owed > 0 || view.writtenOff > 0) && (
        <span className="pt-0.5 text-sm text-text-3">
          {view.writtenOff > 0
            ? t("shared.group.gapWithWriteOff", {
                owed: money.format(view.owed),
                writtenOff: money.format(view.writtenOff),
              })
            : t("shared.group.gap", { owed: money.format(view.owed) })}
        </span>
      )}
    </Card>
  );
}

function GroupBody({ view }: { view: GroupView }) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const noteOf = useNoteOf(view);
  const contacts = useContactsQuery(true);
  const createExpense = useCreateSharedExpense();
  const saveSplit = useSaveSharedSplit();
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<Transaction[]>([]);
  const [splitting, setSplitting] = useState<SharedExpense | null>(null);
  const payerOf = (expense: SharedExpense): string =>
    view.people.find((person) => person.contactId === expense.paidByContactId)?.name ?? "";

  const you = t("shared.group.you");
  const byId = new Map((contacts.data ?? []).map((row) => [row.id, row]));
  // Everybody the group holds, you included, whether or not they are in an expense yet.
  const people: SplitPerson[] = view.group.participants.map((participant) => {
    const contact = participant.contactId === null ? undefined : byId.get(participant.contactId);
    return {
      contactId: participant.contactId,
      name: participant.contactId === null ? you : (contact?.name ?? ""),
      color: contact?.color ?? null,
    };
  });

  function fail(error: unknown) {
    toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
  }

  async function addExpenses() {
    try {
      for (const transaction of adding) {
        await createExpense.mutateAsync(expenseFromTransaction(view.group, transaction));
      }
      toast.show({ message: t("shared.group.expensesAdded", { count: adding.length }) });
      setAdding([]);
    } catch (error) {
      setAdding([]);
      fail(error);
    }
  }

  return (
    <>
      <GroupHero view={view} />
      <Button
        variant="secondary"
        size="lg"
        onClick={() => {
          setPicking(true);
        }}
      >
        <Plus {...iconProps("sm")} />
        {t("shared.group.addExpense")}
      </Button>
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-md font-semibold">{t("shared.group.people")}</h2>
          <span className="text-sm text-text-3">
            {t(`shared.group.defaultSplit.${view.group.defaultSplit.mode}`)}
          </span>
        </div>
        <Card flush>
          <List>
            {/* You are a row like everybody else, with a share of your own. */}
            <Row>
              <Avatar name={t("shared.group.you")} />
              <RowBody>
                <RowTitle>
                  <span>{t("shared.group.you")}</span>
                </RowTitle>
                <RowMeta
                  items={[
                    view.countsAsYours > 0
                      ? t("shared.group.notes.yourPart", {
                          amount: money.format(view.countsAsYours),
                          total: money.format(view.group.totals.amount),
                        })
                      : t("shared.group.notes.nothingFromYou"),
                  ]}
                />
              </RowBody>
              <RowRight sub={t("shared.group.share")}>
                <Amount value={view.you.share} signed={false} />
              </RowRight>
            </Row>
            {view.people.map((person) => (
              <PartyRow key={person.key} person={person} note={noteOf(person)} />
            ))}
          </List>
        </Card>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-md font-semibold">
            {t("shared.group.expenses", { count: view.expenses.length })}
          </h2>
        </div>
        {view.expenses.length === 0 ? (
          <Empty
            icon={<Receipt {...iconProps("lg")} />}
            title={t("shared.group.noExpenses.title")}
            body={t("shared.group.noExpenses.body")}
          />
        ) : (
          <Card flush>
            <List>
              {view.expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  payer={payerOf(expense)}
                  onSplit={() => {
                    setSplitting(expense);
                  }}
                />
              ))}
            </List>
          </Card>
        )}
      </section>
      <TransactionPickerSheet
        open={picking}
        onClose={() => {
          setPicking(false);
        }}
        onDone={(transactions) => {
          setPicking(false);
          setAdding(transactions);
        }}
      />
      <WhatChangesSheet
        open={adding.length > 0}
        onClose={() => {
          setAdding([]);
        }}
        groupName={view.group.name}
        transactions={adding}
        pending={createExpense.isPending}
        onConfirm={() => {
          void addExpenses();
        }}
      />
      {splitting && (
        <SplitSheet
          key={splitting.id}
          open
          onClose={() => {
            setSplitting(null);
          }}
          title={t("shared.split.title", {
            amount: money.format(splitting.amount),
            description: splitting.description ?? t("shared.group.noDescription"),
          })}
          total={splitting.amount}
          currency={splitting.currency}
          people={people}
          payerContactId={splitting.paidByContactId}
          initial={draftOf(splitting, view)}
          note={t("shared.split.thisExpenseOnly", { name: view.group.name })}
          saveLabel={t("shared.split.save")}
          pending={saveSplit.isPending}
          onUseGroupSplit={
            splitting.customSplit
              ? () => {
                  void backToTheGroups(splitting);
                }
              : undefined
          }
          onSave={({ split }) => {
            void save(splitting, split);
          }}
        />
      )}
    </>
  );

  async function save(expense: SharedExpense, split: SharedSplit) {
    try {
      await saveSplit.mutateAsync({
        id: expense.id,
        groupId: expense.groupId,
        split,
        projected: split,
      });
      setSplitting(null);
      toast.show({ message: t("shared.split.saved") });
    } catch (error) {
      setSplitting(null);
      fail(error);
    }
  }

  async function backToTheGroups(expense: SharedExpense) {
    try {
      await saveSplit.mutateAsync({
        id: expense.id,
        groupId: expense.groupId,
        split: null,
        projected: inheritedSplit(view.group, expense.amount, expense.paidByContactId),
      });
      setSplitting(null);
      toast.show({ message: t("shared.split.saved") });
    } catch (error) {
      setSplitting(null);
      fail(error);
    }
  }
}

// What the sheet opens on: the split this expense carries today, read back as a draft.
function draftOf(expense: SharedExpense, view: GroupView) {
  if (!expense.customSplit) return draftFromGroup(view.group);
  return {
    mode: expense.split.mode,
    guests: expense.split.guests,
    inputs: Object.fromEntries(
      expense.split.shares.map((share) => [
        share.party === "GUESTS" ? "guests" : (share.contactId ?? "user"),
        expense.split.mode === "PERCENT" ? share.percent : share.fixedAmount,
      ]),
    ),
  };
}

export function SharedGroupScreen({ id }: { id: string }) {
  const t = useTranslations();
  const back = useBackNavigation();
  const { section, isPending, isError, error, refetch } = useSharedSection();
  const view = section && groupView(section, id);
  const title = (group: SharedGroup | undefined) => group?.name ?? t("shared.group.title");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title(view?.group)}
        onBack={() => {
          back({ pathname: "/shared", query: { face: "groups" } });
        }}
      />
      {isPending ? (
        <div role="status" aria-busy="true" aria-label={t("common.loading")}>
          <Card className="flex flex-col gap-3">
            <Skeleton className="size-10 rounded-[12px]" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-3 w-40" />
          </Card>
        </div>
      ) : isError || !view ? (
        <Empty
          tone="danger"
          icon={<Users {...iconProps("lg")} />}
          title={isError ? t("states.error.title") : t("shared.group.missing.title")}
          body={isError ? <LoadErrorBody error={error} /> : t("shared.group.missing.body")}
          action={<Button onClick={refetch}>{t("common.retry")}</Button>}
        />
      ) : (
        <GroupBody view={view} />
      )}
    </div>
  );
}
