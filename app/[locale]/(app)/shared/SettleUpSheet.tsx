"use client";

import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateTimeField";
import { Field } from "@/components/ui/Field";
import { Sheet, SheetAction, SheetCancel } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import { useRecordSettlement } from "@/features/shared/hooks";
import {
  hasSomethingToSettle,
  planSettlement,
  settleableAmount,
  type SettleParty,
  type SettlePlan,
} from "@/features/shared/settle";
import { presentError } from "@/lib/api/errors";
import { dayKey, localNoon } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { toCents } from "@/lib/local/derive/money";

export interface SettleUpSheetProps {
  party: SettleParty;
  open: boolean;
  onClose: () => void;
  // "Nobody is going to pay me" is the other answer to the same row, and it moves no figure.
  onWriteOff?: () => void;
}

function Summary({ party }: { party: SettleParty }) {
  const t = useTranslations("shared.settle");
  const both = party.owedToYou > 0 && party.youOwe > 0;
  const line = (label: string, amount: number) => (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-text-3">{label}</span>
      <Amount value={amount} signed={false} />
    </div>
  );
  return (
    <Card className="flex flex-col gap-2">
      {party.owedToYou > 0 && line(t("owesYou", { name: party.name }), party.owedToYou)}
      {party.youOwe > 0 && line(t("youOwe", { name: party.name }), party.youOwe)}
      {both && (
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 font-semibold">
          <span className="text-sm">
            {party.net >= 0 ? t("theySend", { name: party.name }) : t("youSend")}
          </span>
          <Amount value={settleableAmount(party)} signed={false} />
        </div>
      )}
    </Card>
  );
}

function Coverage({ plan }: { plan: SettlePlan }) {
  const t = useTranslations("shared.settle");
  const dates = useDates();
  if (plan.covers.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-text-3">{t("covers")}</span>
      {plan.covers.map((line) => (
        <div key={line.expenseId} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="min-w-0 truncate">
            {line.groupName} · {line.description ?? t("noDescription")}{" "}
            <span className="text-text-3">{dates.formatDay(new Date(line.date))}</span>
          </span>
          <Amount value={line.covered} signed={false} size="sm" />
        </div>
      ))}
    </div>
  );
}

export function SettleUpSheet({ party, open, onClose, onWriteOff }: SettleUpSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const dates = useDates();
  const toast = useToast();
  const record = useRecordSettlement();
  const inbound = party.net >= 0;
  const most = settleableAmount(party);
  const [amount, setAmount] = useState<number | null>(most);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [perLine, setPerLine] = useState<Record<string, string>>({});
  const { timeZone } = useFormatSettings();
  const [openedAt] = useState(() => new Date());
  const [chosenDay, setDay] = useState<string | null>(null);
  const day = chosenDay ?? dayKey(openedAt, timeZone);

  const cash = amount ?? 0;
  const plan = planSettlement(party, cash);
  const over = toCents(cash) > toCents(most);
  const needsCategory = plan.yourLines.length > 0 && !outside;
  const missingCategory = plan.yourLines.some((line) => !(perLine[line.expenseId] ?? categoryId));
  // Two people owing each other the same net to nothing, and that settle-up is still a settle-up.
  const ready =
    (cash > 0 || (most === 0 && hasSomethingToSettle(party))) &&
    !over &&
    (outside || accountId !== null) &&
    (!needsCategory || !missingCategory) &&
    !record.isPending;
  const error = record.error ? presentError(record.error) : null;

  async function settle() {
    if (!ready) return;
    try {
      await record.mutateAsync({
        counterparty: { contactId: party.contactId, expenseId: party.expenseId },
        date: localNoon(day, timeZone).toISOString(),
        collected: plan.collected,
        paid: plan.paid,
        outsideApp: outside,
        accountId: outside ? null : accountId,
        refunded: outside ? 0 : plan.refunded,
        lines: outside
          ? []
          : plan.yourLines.map((line) => ({
              expenseId: line.expenseId,
              date: line.date,
              description: line.description,
              amount: line.covered,
              categoryId: perLine[line.expenseId] ?? categoryId ?? "",
            })),
      });
      toast.show({ message: t("shared.settle.recorded") });
      onClose();
    } catch {
      return;
    }
  }

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      unsaved={toCents(cash) !== toCents(most)}
      title={
        inbound
          ? t("shared.settle.title", { name: party.name })
          : t("shared.settle.payTitle", { name: party.name })
      }
      footer={
        <>
          {error && <Alert tone="danger">{t(error.messageKey)}</Alert>}
          <SheetAction
            block
            disabled={!ready}
            loading={record.isPending}
            onClick={() => {
              void settle();
            }}
          >
            {inbound
              ? t("shared.settle.record")
              : t("shared.settle.pay", { amount: money.format(cash) })}
          </SheetAction>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Summary party={party} />
        <Field
          label={t("shared.settle.amount")}
          error={over ? t("shared.settle.over", { amount: money.format(most) }) : undefined}
        >
          <Card className="p-0 pb-3">
            <AmountInput
              label={t("shared.settle.amount")}
              value={amount}
              onChange={setAmount}
              autoFocus
              invalid={over}
              className="py-4"
            />
          </Card>
        </Field>
        <DateField
          label={t("shared.settle.date")}
          value={day}
          max={dayKey(openedAt, timeZone)}
          onChange={setDay}
        />
        <AccountPicker
          label={t(inbound ? "shared.settle.arrives" : "shared.settle.leaves")}
          value={outside ? null : accountId}
          allowCreate={false}
          onChange={(account) => {
            setOutside(false);
            setAccountId(account.id);
          }}
          outside={{
            label: t("shared.settle.outside"),
            meta: t("shared.settle.outsideMeta"),
            selected: outside,
            onSelect: () => {
              setOutside(true);
              setAccountId(null);
            },
          }}
        />
        {needsCategory && (
          <div className="flex flex-col gap-3">
            <CategoryPicker
              type="EXPENSE"
              label={
                plan.yourLines.length === 1
                  ? t("shared.settle.categoryFor", {
                      amount: money.format(plan.yourLines[0]?.covered ?? 0),
                      description:
                        plan.yourLines[0]?.description ?? t("shared.settle.noDescription"),
                    })
                  : t("shared.settle.category")
              }
              value={categoryId}
              allowCreate={false}
              onChange={(category) => {
                setCategoryId(category.id);
                setPerLine({});
              }}
            />
            {plan.yourLines.length > 1 &&
              plan.yourLines.map((line) => (
                <CategoryPicker
                  key={line.expenseId}
                  type="EXPENSE"
                  label={t("shared.settle.categoryForLine", {
                    amount: money.format(line.covered),
                    description: line.description ?? t("shared.settle.noDescription"),
                    date: dates.formatDay(new Date(line.date)),
                  })}
                  value={perLine[line.expenseId] ?? categoryId}
                  allowCreate={false}
                  onChange={(category) => {
                    setPerLine((held) => ({ ...held, [line.expenseId]: category.id }));
                  }}
                />
              ))}
          </div>
        )}
        {outside ? (
          <Alert tone="warning" title={t("shared.settle.outsideTitle")}>
            {t("shared.settle.outsideBody", { amount: money.format(cash) })}
          </Alert>
        ) : plan.yourLines.length > 0 && plan.collected > 0 ? (
          <Alert tone="neutral" title={t("shared.settle.bothTitle")}>
            {t("shared.settle.bothBody", {
              collected: money.format(plan.collected),
              paid: money.format(plan.paid),
              net: money.format(cash),
            })}
          </Alert>
        ) : plan.yourLines.length > 0 ? (
          <Alert tone="neutral" title={t("shared.settle.yourExpenseTitle")}>
            {t("shared.settle.yourExpenseBody", { amount: money.format(plan.paid) })}
          </Alert>
        ) : (
          <Alert tone="neutral" title={t("shared.settle.notIncomeTitle")}>
            {t("shared.settle.notIncomeBody")}
          </Alert>
        )}
        {plan.refunded > 0 && (
          <p className="text-sm text-text-3">
            {t("shared.settle.refunded", { amount: money.format(plan.refunded) })}
          </p>
        )}
        <Coverage plan={plan} />
        {toCents(cash) < toCents(most) && party.youOwe > 0 && party.owedToYou > 0 && (
          <p className="text-xs text-text-3">{t("shared.settle.partialFirst")}</p>
        )}
        {onWriteOff && (
          <Button variant="ghost" size="sm" className="self-start px-0" onClick={onWriteOff}>
            <Ban {...iconProps("sm")} />
            {t("shared.settle.writeOff", { amount: money.format(party.owedToYou) })}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
