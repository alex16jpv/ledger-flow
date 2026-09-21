"use client";

import { Archive, Calendar, HandCoins, Plus, Receipt, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

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
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { useGroupRange } from "@/features/shared/components/GroupRowLink";
import { StateBadge } from "@/features/shared/components/parts";
import { type SplitPerson, SplitSheet } from "@/features/shared/components/SplitSheet";
import {
  useArchiveSharedGroup,
  useContactsQuery,
  useCreateSharedExpense,
  useSaveSharedSplit,
  useSharedSection,
  useUndoWriteOff,
  useWriteOff,
} from "@/features/shared/hooks";
import {
  type GroupView,
  groupView,
  type PartyView,
  type SharedSection,
} from "@/features/shared/ledger";
import { hasSomethingToSettle, type SettleParty, settleParty } from "@/features/shared/settle";
import { GUESTS_KEY, USER_KEY } from "@/features/shared/split";
import { draftFromGroup, expenseFromTransaction, inheritedSplit } from "@/features/shared/write";
import { presentError } from "@/lib/api/errors";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { useBackNavigation } from "@/lib/navigation/history";
import { featureColorStyle } from "@/lib/theme/feature-color";
import type { SharedExpense, SharedSplit, Transaction } from "@/types/api";

import { SettleUpSheet } from "../../SettleUpSheet";
import { TransactionPickerSheet } from "../../TransactionPickerSheet";
import { WhatChangesSheet } from "../../WhatChangesSheet";
import { ArchiveGroupSheet, UndoWriteOffSheet, WriteOffSheet } from "../../WriteOffSheet";

function useNoteOf(view: GroupView): (person: PartyView) => string {
  const t = useTranslations("shared.group.notes");
  const money = useMoney();
  const dates = useDates();
  const writeOffs = useMemo(
    () =>
      new Map(
        view.group.writeOffs.map((one) => [
          one.expenseId ? `guests:${one.expenseId}` : `contact:${one.contactId}`,
          one,
        ]),
      ),
    [view.group.writeOffs],
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

function PartyBody({ person, note }: { person: PartyView; note: string }) {
  const t = useTranslations("shared.group");
  return (
    <>
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
          {/* The four states are about money owed to you: somebody who owes you none has none. */}
          {(person.owesYou > 0 || person.paid > 0 || person.state === "WRITTEN_OFF") && (
            <StateBadge state={person.state} />
          )}
        </RowTitle>
        <RowMeta items={[note]} />
      </RowBody>
      <RowRight sub={t("share")}>
        <Amount value={person.share} signed={false} />
      </RowRight>
    </>
  );
}

// Somebody with nothing open is a row that reads; the rest is a row that settles or takes back.
function PartyRow({
  person,
  note,
  onOpen,
}: {
  person: PartyView;
  note: string;
  onOpen: (() => void) | undefined;
}) {
  if (!onOpen) {
    return (
      <Row>
        <PartyBody person={person} note={note} />
      </Row>
    );
  }
  return (
    <RowButton onClick={onOpen}>
      <PartyBody person={person} note={note} />
    </RowButton>
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

function GroupBody({ view, section }: { view: GroupView; section: SharedSection }) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const noteOf = useNoteOf(view);
  const contacts = useContactsQuery(true);
  const createExpense = useCreateSharedExpense();
  const saveSplit = useSaveSharedSplit();
  const writeOff = useWriteOff();
  const undo = useUndoWriteOff();
  const archive = useArchiveSharedGroup();
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState<Transaction[]>([]);
  const [splitting, setSplitting] = useState<SharedExpense | null>(null);
  const [settling, setSettling] = useState<SettleParty | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [writingOff, setWritingOff] = useState<PartyView | null>(null);
  const [undoing, setUndoing] = useState<PartyView | null>(null);
  const [archiving, setArchiving] = useState(false);
  // The written-off ceiling is what the row gets back if you take the decision back.
  const ceilingOf = (person: PartyView): number =>
    view.group.writeOffs.find(
      (one) => one.contactId === person.contactId && one.expenseId === person.expenseId,
    )?.amount ?? 0;
  const open = view.people.filter(
    (person) => person.owesYou > 0 || person.youOwe > 0 || person.surplus > 0,
  );
  const actionFor = (person: PartyView): (() => void) | undefined => {
    if (person.state === "WRITTEN_OFF") {
      return () => {
        setUndoing(person);
      };
    }
    const party = settleParty(section, view, person);
    if (!hasSomethingToSettle(party)) return undefined;
    return () => {
      setSettling(party);
    };
  };
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
    const left = [...adding];
    try {
      // Whatever lands stays landed: a second try sends only what is still missing.
      for (const transaction of [...left]) {
        await createExpense.mutateAsync(expenseFromTransaction(view.group, transaction));
        left.shift();
      }
      toast.show({ message: t("shared.group.expensesAdded", { count: adding.length }) });
      setAdding([]);
    } catch (error) {
      setAdding(left);
      fail(error);
    }
  }

  return (
    <>
      <GroupHero view={view} />
      <Button
        size="lg"
        block
        disabled={open.length === 0}
        onClick={() => {
          if (open.length === 1 && open[0]) setSettling(settleParty(section, view, open[0]));
          else setChoosing(true);
        }}
      >
        <HandCoins {...iconProps("sm")} />
        {t("shared.group.settleUp")}
      </Button>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          onClick={() => {
            setPicking(true);
          }}
        >
          <Plus {...iconProps("sm")} />
          {t("shared.group.addExpense")}
        </Button>
        <Button
          variant="secondary"
          disabled={view.group.archivedAt !== null}
          onClick={() => {
            setArchiving(true);
          }}
        >
          <Archive {...iconProps("sm")} />
          {t("shared.group.archive")}
        </Button>
      </div>
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
              <PartyRow
                key={person.key}
                person={person}
                note={noteOf(person)}
                onOpen={actionFor(person)}
              />
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
      {picking && (
        <TransactionPickerSheet
          open
          selected={adding}
          onClose={() => {
            setPicking(false);
          }}
          onDone={(transactions) => {
            setPicking(false);
            setAdding(transactions);
          }}
        />
      )}
      {adding.length > 0 && (
        <WhatChangesSheet
          open
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
      )}
      {choosing && (
        <Sheet
          open
          onClose={() => {
            setChoosing(false);
          }}
          title={t("shared.group.whoToSettle")}
        >
          <Card flush>
            <List>
              {open.map((person) => (
                <RowButton
                  key={person.key}
                  onClick={() => {
                    setChoosing(false);
                    setSettling(settleParty(section, view, person));
                  }}
                >
                  <PartyBody person={person} note={noteOf(person)} />
                </RowButton>
              ))}
            </List>
          </Card>
        </Sheet>
      )}
      {settling && (
        <SettleUpSheet
          key={settling.key}
          open
          party={settling}
          onClose={() => {
            setSettling(null);
          }}
          onWriteOff={
            settling.owedToYou > 0
              ? () => {
                  const person = view.people.find((one) => one.key === settling.key);
                  setSettling(null);
                  if (person) setWritingOff(person);
                }
              : undefined
          }
        />
      )}
      {writingOff && (
        <WriteOffSheet
          open
          view={view}
          person={writingOff}
          pending={writeOff.isPending}
          onClose={() => {
            setWritingOff(null);
          }}
          onConfirm={() => {
            void forgive(writingOff);
          }}
        />
      )}
      {undoing && (
        <UndoWriteOffSheet
          open
          person={undoing}
          amount={ceilingOf(undoing)}
          pending={undo.isPending}
          onClose={() => {
            setUndoing(null);
          }}
          onConfirm={() => {
            void takeBack(undoing);
          }}
        />
      )}
      {archiving && (
        <ArchiveGroupSheet
          open
          view={view}
          pending={archive.isPending}
          onClose={() => {
            setArchiving(false);
          }}
          onConfirm={() => {
            void archiveIt();
          }}
        />
      )}
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

  async function forgive(person: PartyView) {
    try {
      await writeOff.mutateAsync({
        groupId: view.group.id,
        contactId: person.contactId,
        expenseId: person.expenseId,
        amount: person.owesYou,
      });
      setWritingOff(null);
      toast.show({ message: t("shared.writeOff.done", { name: person.name }) });
    } catch (error) {
      setWritingOff(null);
      fail(error);
    }
  }

  async function takeBack(person: PartyView) {
    try {
      await undo.mutateAsync({
        groupId: view.group.id,
        contactId: person.contactId,
        expenseId: person.expenseId,
      });
      setUndoing(null);
      toast.show({ message: t("shared.writeOff.undone", { name: person.name }) });
    } catch (error) {
      setUndoing(null);
      fail(error);
    }
  }

  async function archiveIt() {
    try {
      await archive.mutateAsync({
        id: view.group.id,
        // Archiving writes off what is still owed, and the mirror has to say so as well.
        owing: view.people
          .filter((person) => person.owesYou > 0)
          .map((person) => ({
            contactId: person.contactId,
            expenseId: person.expenseId,
            amount: person.owesYou,
          })),
      });
      setArchiving(false);
      toast.show({ message: t("shared.archiveGroup.done", { name: view.group.name }) });
    } catch (error) {
      setArchiving(false);
      fail(error);
    }
  }

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

function draftOf(expense: SharedExpense, view: GroupView) {
  if (!expense.customSplit) return draftFromGroup(view.group);
  return {
    mode: expense.split.mode,
    guests: expense.split.guests,
    inputs: Object.fromEntries(
      expense.split.shares.map((share) => [
        share.party === "GUESTS" ? GUESTS_KEY : (share.contactId ?? USER_KEY),
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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("shared.group.title")}
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
        <GroupBody view={view} section={section} />
      )}
    </div>
  );
}
