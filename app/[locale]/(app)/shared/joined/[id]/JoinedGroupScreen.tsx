"use client";

import { Calendar, CircleCheck, CirclePlus, LogOut, Receipt, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Progress } from "@/components/ui/Progress";
import { List, Row, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { useGroupRange } from "@/features/shared/components/GroupRowLink";
import { StateBadge } from "@/features/shared/components/parts";
import { useJoinedGroups, useLeaveGroup } from "@/features/shared/hooks";
import { presentError } from "@/lib/api/errors";
import { useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type { JoinedGroupStanding, JoinedLine, JoinedPerson } from "@/lib/local/derive";
import { useBackNavigation } from "@/lib/navigation/history";
import { useOffline } from "@/lib/network/useOffline";
import { featureColorStyle } from "@/lib/theme/feature-color";
import type { JoinedExpense, JoinedGroup } from "@/types/api";

import type { LedgerLine } from "../../AddToLedgerSheet";

// Two taps behind a screen that reads; nothing on it needs the pickers until you add something.
const AddToLedgerSheet = dynamic(() =>
  import("../../AddToLedgerSheet").then((module) => module.AddToLedgerSheet),
);

const rich = { b: (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b> };

function Hero({ group, standing }: { group: JoinedGroup; standing: JoinedGroupStanding }) {
  const t = useTranslations("shared.joined");
  const money = useMoney();
  const range = useGroupRange();
  const owner = group.ownerName;
  const lead =
    standing.net > 0
      ? t("youOwe", { name: owner })
      : standing.net < 0
        ? t("owesYou", { name: owner })
        : t("square", { name: owner });
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
        {standing.dateFrom && (
          <Badge tone="outline">
            <Calendar {...iconProps("sm")} />
            {range(standing.dateFrom, standing.dateTo)}
          </Badge>
        )}
      </div>
      <h2 className="pt-1.5 text-xl font-semibold tracking-[-0.02em]">{group.name}</h2>
      <span className="text-xs font-medium tracking-caps text-text-3 uppercase">{lead}</span>
      {/* A debt between two people is neither income nor spending: neutral, with a word. */}
      <Amount value={Math.abs(standing.net)} signed={false} size="hero" />
      <span className="text-sm text-text-3">
        {t("lead", {
          total: money.format(standing.amount),
          share: money.format(standing.yourShare),
        })}
      </span>
      {standing.owedToOwner > 0 && (
        <div className="flex flex-col gap-1 pt-2.5">
          <Progress
            thin
            plain
            value={standing.paidToOwner}
            max={standing.owedToOwner}
            color={group.color}
            label={t("barLabel", { name: owner })}
          />
          <span className="text-xs text-text-3">
            {t("bar", {
              paid: money.format(standing.paidToOwner),
              total: money.format(standing.owedToOwner),
              name: owner,
            })}
          </span>
        </div>
      )}
      <span className="pt-0.5 text-sm text-text-3">
        {group.archivedAt === null
          ? t("readOnly", { name: owner })
          : t("archivedGap", { name: owner })}
      </span>
    </Card>
  );
}

function usePersonNote(owner: string): (person: JoinedPerson) => string {
  const t = useTranslations("shared.joined");
  const money = useMoney();
  return (person) => {
    if (person.state === null) return t("owner");
    if (person.state === "WRITTEN_OFF") return t("personOff", { owner });
    if (person.state === "PAID") return t("personPaid", { owner });
    if (person.state === "PARTIALLY_PAID") {
      return t("personPartly", {
        paid: money.format(person.paid),
        open: money.format(person.open),
        owner,
      });
    }
    return t("personNotPaid", { owner });
  };
}

function useLineNote(group: JoinedGroup): (line: JoinedLine, expense: JoinedExpense) => string[] {
  const t = useTranslations("shared.joined.line");
  const money = useMoney();
  const dates = useDates();
  const owner = group.ownerName;
  const nameOf = (contactId: string | null) =>
    group.participants.find((one) => one.contactId === contactId)?.name ?? "";
  return (line, expense) => {
    const day = dates.formatDay(new Date(expense.date));
    switch (line.state) {
      case "IN_LEDGER": {
        const notes = [day, t("added", { owner })];
        // Your ledger is yours: what changed on the owner's side is said, never applied.
        if (line.addedAmount !== null && line.addedAmount !== line.yourShare) {
          notes.push(
            t("amountChanged", {
              added: money.format(line.addedAmount),
              share: money.format(line.yourShare),
            }),
          );
        }
        if (!line.stillPaid) notes.push(t("noLongerPaid", { owner }));
        return notes;
      }
      case "PAID":
        return [day, t("ready", { owner })];
      case "NOT_PAID":
        return [day, t("notPaid", { owner })];
      case "WRITTEN_OFF":
        return [day, t("writtenOff", { owner })];
      case "OTHER_PAID":
        return [day, t("otherPaid", { name: nameOf(expense.paidByContactId) })];
      case "YOU_PAID":
        return [day, t("youPaid")];
      case "NO_PART":
        return [day, t("noPart", { owner })];
    }
  };
}

function LineBadge({ line }: { line: JoinedLine }) {
  const t = useTranslations("shared");
  if (line.state === "IN_LEDGER") {
    return (
      <Badge tone="success">
        <CircleCheck {...iconProps("sm")} />
        {t("joined.line.inLedger")}
      </Badge>
    );
  }
  if (line.state === "PAID") return <StateBadge state="PAID" />;
  if (line.state === "NOT_PAID") return <StateBadge state="NOT_PAID" />;
  if (line.state === "WRITTEN_OFF") return <StateBadge state="WRITTEN_OFF" />;
  return null;
}

function JoinedBody({
  group,
  standing,
  expenses,
}: {
  group: JoinedGroup;
  standing: JoinedGroupStanding;
  expenses: JoinedExpense[];
}) {
  const t = useTranslations();
  const money = useMoney();
  const router = useRouter();
  const toast = useToast();
  const offline = useOffline();
  const leave = useLeaveGroup();
  const personNote = usePersonNote(group.ownerName);
  const lineNote = useLineNote(group);
  const [adding, setAdding] = useState<LedgerLine[] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const byId = new Map(expenses.map((expense) => [expense.id, expense]));
  const people = new Map(standing.people.map((person) => [person.contactId, person]));
  const toLedger = (ids: string[]): LedgerLine[] =>
    ids.flatMap((id) => {
      const expense = byId.get(id);
      const line = standing.lines.find((one) => one.id === id);
      return expense && line
        ? [
            {
              expenseId: id,
              description: expense.description,
              date: expense.date,
              amount: line.yourShare,
            },
          ]
        : [];
    });
  const openLine = (line: JoinedLine): (() => void) | undefined => {
    if (line.state === "PAID") {
      return () => {
        setAdding(toLedger([line.id]));
      };
    }
    if (line.state === "IN_LEDGER" && line.addedId) {
      const id = line.addedId;
      return () => {
        router.push(`/transactions/${id}`);
      };
    }
    return undefined;
  };

  async function leaveIt() {
    try {
      await leave.mutateAsync({ invitationId: group.invitationId, groupId: group.id });
      toast.show({ message: t("shared.joined.left", { group: group.name }) });
      router.replace({ pathname: "/shared", query: { face: "groups" } });
    } catch (error) {
      setLeaving(false);
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <>
      <Hero group={group} standing={standing} />
      {group.archivedAt !== null && (
        <Alert tone="neutral" title={t("shared.joined.archivedTitle", { name: group.ownerName })}>
          {t("shared.joined.archivedBody")}
        </Alert>
      )}
      {standing.ready.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Button
            size="lg"
            block
            disabled={offline}
            onClick={() => {
              setAdding(toLedger(standing.ready));
            }}
          >
            <CirclePlus {...iconProps("sm")} />
            {t("shared.joined.ready", { count: standing.ready.length })}
          </Button>
          {offline && (
            <p role="status" className="px-1 text-xs text-text-2">
              {t("shared.joined.offline")}
            </p>
          )}
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-md font-semibold">{t("shared.joined.people")}</h2>
        <Card flush>
          <List>
            {group.participants.map((participant) => {
              const person = people.get(participant.contactId);
              if (!person) return null;
              const note = participant.joined
                ? personNote(person)
                : [personNote(person), t("shared.joined.notJoined", { owner: group.ownerName })]
                    .filter(Boolean)
                    .join(" · ");
              return (
                <Row key={participant.contactId ?? "owner"}>
                  <Avatar name={participant.name} color={participant.color} />
                  <RowBody>
                    <RowTitle>
                      <span>{participant.you ? t("shared.joined.you") : participant.name}</span>
                      {person.state !== null && person.share > 0 && (
                        <StateBadge state={person.state} />
                      )}
                    </RowTitle>
                    <RowMeta items={[note]} />
                  </RowBody>
                  <RowRight sub={t("shared.joined.share")}>
                    <Amount value={person.share} signed={false} />
                  </RowRight>
                </Row>
              );
            })}
          </List>
        </Card>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-md font-semibold">
          {t("shared.joined.expenses", { count: standing.lines.length })}
        </h2>
        {standing.lines.length > 0 && (
          <Card flush>
            <List>
              {standing.lines.map((line) => {
                const expense = byId.get(line.id);
                if (!expense) return null;
                const owners = expense.paidByContactId === null;
                const body = (
                  <>
                    <Tile color={owners ? group.color : "GRAY"}>
                      <Receipt {...iconProps("md")} />
                    </Tile>
                    <RowBody>
                      <RowTitle>
                        <span>{expense.description ?? t("shared.joined.noDescription")}</span>
                        <LineBadge line={line} />
                      </RowTitle>
                      <RowMeta items={lineNote(line, expense)} />
                    </RowBody>
                    <RowRight
                      sub={t("shared.joined.yourShare", { amount: money.format(line.yourShare) })}
                    >
                      <Amount value={expense.amount} signed={false} />
                    </RowRight>
                  </>
                );
                const onOpen = openLine(line);
                return onOpen && !(line.state === "PAID" && offline) ? (
                  <RowButton key={line.id} onClick={onOpen}>
                    {body}
                  </RowButton>
                ) : (
                  <Row key={line.id}>{body}</Row>
                );
              })}
            </List>
          </Card>
        )}
      </section>
      <p className="text-center text-xs text-text-3">
        {t("shared.joined.frontier", { owner: group.ownerName })}
      </p>
      <Button
        variant="ghost"
        className="self-center"
        onClick={() => {
          setLeaving(true);
        }}
      >
        <LogOut {...iconProps("sm")} />
        {t("shared.joined.leave")}
      </Button>
      {adding && (
        <AddToLedgerSheet
          open
          groupId={group.id}
          owner={group.ownerName}
          lines={adding}
          onClose={() => {
            setAdding(null);
          }}
        />
      )}
      {leaving && (
        <Sheet
          open
          onClose={() => {
            setLeaving(false);
          }}
          title={t("shared.joined.leaveTitle", { group: group.name })}
          footer={
            <>
              <Button
                size="lg"
                block
                variant="dangerSolid"
                loading={leave.isPending}
                disabled={offline}
                onClick={() => {
                  void leaveIt();
                }}
              >
                {t("shared.joined.leaveConfirm")}
              </Button>
              <SheetCancel />
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Alert tone="warning">
              {t.rich("shared.joined.leaveAlert", {
                group: group.name,
                owner: group.ownerName,
                ...rich,
              })}
            </Alert>
            <p className="text-sm text-text-3">{t("shared.joined.leaveBody")}</p>
            <p className="text-xs text-text-3">
              {t("shared.joined.leaveFoot", { owner: group.ownerName })}
            </p>
            {offline && (
              <p role="status" className="text-xs text-text-2">
                {t("shared.joined.offline")}
              </p>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function JoinedGroupScreen({ id }: { id: string }) {
  const t = useTranslations();
  const back = useBackNavigation();
  const { view, isPending, isError, error, refetch } = useJoinedGroups();
  const group = view?.rows.groups.find((one) => one.id === id);
  const standing = view?.standings.get(id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("shared.joined.title")}
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
      ) : isError || !group || !standing ? (
        <Empty
          tone={isError ? "danger" : undefined}
          icon={<Users {...iconProps("lg")} />}
          title={isError ? t("states.error.title") : t("shared.joined.gone")}
          body={isError ? <LoadErrorBody error={error} /> : undefined}
          action={
            isError ? (
              <Button
                onClick={() => {
                  void refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <JoinedBody group={group} standing={standing} expenses={view?.rows.expenses ?? []} />
      )}
    </div>
  );
}
