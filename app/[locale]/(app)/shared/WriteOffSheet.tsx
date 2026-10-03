"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { useRecordSettlement } from "@/features/shared/hooks";
import type { GroupView, PartyView, SharedSection } from "@/features/shared/ledger";
import { planCrossing, settleParty, type SettlePlan } from "@/features/shared/settle";
import { presentError } from "@/lib/api/errors";
import { dayKey, localNoon } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useMoney } from "@/lib/i18n/useMoney";
import { fromCents, toCents } from "@/lib/local/derive/money";

import {
  categoryOf,
  LineCategories,
  type LineCategoriesValue,
  missingCategory,
} from "./LineCategories";

export interface WriteOff {
  contactId: string | null;
  expenseId: string | null;
  amount: number;
}

interface Crossing {
  person: PartyView;
  plan: SettlePlan;
}

// Somebody you also owe in the group is squared first, so a write-off leaves nobody owing there.
function crossingsOf(section: SharedSection, view: GroupView, people: readonly PartyView[]) {
  return people.flatMap((person): Crossing[] => {
    if (person.contactId === null) return [];
    const plan = planCrossing(settleParty(section, view, person));
    return plan ? [{ person, plan }] : [];
  });
}

const leftToWriteOff = (person: PartyView, crossings: readonly Crossing[]): number => {
  const crossed = crossings.find((one) => one.person.key === person.key)?.plan.collected ?? 0;
  return fromCents(Math.max(0, toCents(person.owesYou) - toCents(crossed)));
};

function useCrossing(crossings: readonly Crossing[]) {
  const record = useRecordSettlement();
  const { timeZone } = useFormatSettings();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categories, setCategories] = useState<LineCategoriesValue>({
    categoryId: null,
    perLine: {},
  });
  const lines = crossings.flatMap((one) => one.plan.yourLines);
  const ready =
    crossings.length === 0 || (accountId !== null && !missingCategory(categories, lines));
  async function cross(): Promise<void> {
    if (!accountId) return;
    const date = localNoon(dayKey(new Date(), timeZone), timeZone).toISOString();
    for (const { person, plan } of crossings) {
      await record.mutateAsync({
        counterparty: { contactId: person.contactId, expenseId: null },
        groupId: plan.groupId,
        date,
        collected: plan.collected,
        paid: plan.paid,
        outsideApp: false,
        accountId,
        refunded: 0,
        lines: plan.yourLines.map((line) => ({
          expenseId: line.expenseId,
          date: line.date,
          description: line.description,
          amount: line.covered,
          categoryId: categoryOf(categories, line) ?? "",
        })),
      });
    }
  }
  return { record, accountId, setAccountId, categories, setCategories, lines, ready, cross };
}

function CrossingFields({ crossing }: { crossing: ReturnType<typeof useCrossing> }) {
  const t = useTranslations("shared.writeOff");
  return (
    <>
      <AccountPicker
        label={t("crossAccount")}
        value={crossing.accountId}
        allowCreate={false}
        onChange={(account) => {
          crossing.setAccountId(account.id);
        }}
      />
      <LineCategories
        lines={crossing.lines}
        value={crossing.categories}
        onChange={crossing.setCategories}
      />
    </>
  );
}

function summaryLine(label: string, amount: number, strong = false) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between gap-3 border-t border-border pt-2 font-semibold"
          : "flex items-baseline justify-between gap-3"
      }
    >
      <span className={strong ? "text-sm" : "text-sm text-text-3"}>{label}</span>
      <Amount value={amount} signed={false} />
    </div>
  );
}

export interface WriteOffSheetProps {
  section: SharedSection;
  view: GroupView;
  person: PartyView;
  open: boolean;
  pending: boolean;
  onConfirm: (writeOff: WriteOff) => void;
  onClose: () => void;
}

export function WriteOffSheet({
  section,
  view,
  person,
  open,
  pending,
  onConfirm,
  onClose,
}: WriteOffSheetProps) {
  const t = useTranslations("shared.writeOff");
  const ts = useTranslations("shared.settle");
  const tr = useTranslations();
  const money = useMoney();
  const crossings = crossingsOf(section, view, [person]);
  const crossing = useCrossing(crossings);
  const [crossed] = crossings;
  const amount = leftToWriteOff(person, crossings);
  const error = crossing.record.error ? presentError(crossing.record.error) : null;
  const busy = pending || crossing.record.isPending;
  const left = view.people
    .filter((one) => one.key !== person.key)
    .reduce((cents, one) => cents + Math.max(0, toCents(one.net)), 0);
  const where = { name: person.name, group: view.group.name };

  async function confirm() {
    if (!crossing.ready) return;
    try {
      await crossing.cross();
    } catch {
      return;
    }
    onConfirm({ contactId: person.contactId, expenseId: person.expenseId, amount });
  }

  return (
    <Sheet
      layout={crossed ? "full" : "dialog"}
      open={open}
      onClose={onClose}
      title={
        crossed
          ? t("squareTitle", where)
          : t("title", { name: person.name, amount: money.format(amount) })
      }
      footer={
        <>
          {error && <Alert tone="danger">{tr(error.messageKey)}</Alert>}
          <Button
            size="lg"
            block
            variant="dangerSolid"
            disabled={!crossing.ready}
            loading={busy}
            onClick={() => {
              void confirm();
            }}
          >
            {t("confirm", { amount: money.format(amount) })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {crossed ? (
          <>
            <Card className="flex flex-col gap-2">
              {summaryLine(ts("owesYouIn", where), person.owesYou)}
              {summaryLine(ts("youOweIn", where), crossed.plan.paid)}
              {summaryLine(t("writtenOffLine"), amount, true)}
            </Card>
            <CrossingFields crossing={crossing} />
            <Alert tone="neutral" title={t("crossTitle", where)}>
              {t("crossBody", {
                name: person.name,
                crossed: money.format(crossed.plan.paid),
                amount: money.format(amount),
              })}
            </Alert>
            <p className="text-xs text-text-3">
              {t("onlyThisGroup", { name: person.name, amount: money.format(amount) })}
            </p>
          </>
        ) : (
          <Alert tone="neutral" title={t("noFigureMoves")}>
            {t("body")}
          </Alert>
        )}
        <p className="text-sm text-text-3">
          {person.paid > 0
            ? t("keepsWhatWasPaid", { name: person.name, amount: money.format(person.paid) })
            : t("rowReadsWrittenOff", { name: person.name })}{" "}
          {left <= 0 && view.youOwe <= 0
            ? t("becomesSettled", { name: view.group.name })
            : t("stillOwed", { amount: money.format(fromCents(left)) })}{" "}
          {t("undoable")}
        </p>
      </div>
    </Sheet>
  );
}

export interface ArchiveGroupSheetProps {
  section: SharedSection;
  view: GroupView;
  open: boolean;
  pending: boolean;
  onConfirm: (owing: WriteOff[]) => void;
  onClose: () => void;
}

export function ArchiveGroupSheet({
  section,
  view,
  open,
  pending,
  onConfirm,
  onClose,
}: ArchiveGroupSheetProps) {
  const t = useTranslations("shared.archiveGroup");
  const tr = useTranslations();
  const money = useMoney();
  const crossings = crossingsOf(section, view, view.people);
  const crossing = useCrossing(crossings);
  const owing = view.people
    .map((person) => ({
      contactId: person.contactId,
      expenseId: person.expenseId,
      amount: leftToWriteOff(person, crossings),
    }))
    .filter((one) => one.amount > 0);
  const total = fromCents(owing.reduce((cents, one) => cents + toCents(one.amount), 0));
  const error = crossing.record.error ? presentError(crossing.record.error) : null;

  async function confirm() {
    if (!crossing.ready) return;
    try {
      await crossing.cross();
    } catch {
      return;
    }
    onConfirm(owing);
  }

  return (
    <Sheet
      layout={crossings.length > 0 ? "full" : "dialog"}
      open={open}
      onClose={onClose}
      title={t("title", { name: view.group.name })}
      footer={
        <>
          {error && <Alert tone="danger">{tr(error.messageKey)}</Alert>}
          <Button
            size="lg"
            block
            variant="dangerSolid"
            disabled={!crossing.ready}
            loading={pending || crossing.record.isPending}
            onClick={() => {
              void confirm();
            }}
          >
            {total > 0 ? t("confirmWithWriteOff", { amount: money.format(total) }) : t("confirm")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {total > 0 && (
          <Alert tone="warning" title={t("stillOwed", { amount: money.format(total) })}>
            {t("writesItOff")}
          </Alert>
        )}
        {crossings.length > 0 && (
          <>
            <p className="text-sm text-text-3">
              {t("crossBody", {
                names: crossings.map((one) => one.person.name).join(", "),
              })}
            </p>
            <CrossingFields crossing={crossing} />
            <p className="text-xs text-text-3">{t("onlyThisGroup")}</p>
          </>
        )}
        <p className="text-sm text-text-3">{t("body")}</p>
      </div>
    </Sheet>
  );
}

export interface UndoWriteOffSheetProps {
  person: PartyView;
  amount: number;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function UndoWriteOffSheet({
  person,
  amount,
  open,
  pending,
  onConfirm,
  onClose,
}: UndoWriteOffSheetProps) {
  const t = useTranslations("shared.writeOff");
  const money = useMoney();
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("undoTitle", { name: person.name })}
      footer={
        <>
          <Button size="lg" block loading={pending} onClick={onConfirm}>
            {t("undoConfirm", { amount: money.format(amount) })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <p className="text-sm text-text-3">
        {t("undoBody", { name: person.name, amount: money.format(amount) })}
      </p>
    </Sheet>
  );
}
