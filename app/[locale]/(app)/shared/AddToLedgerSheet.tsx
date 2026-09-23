"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Card } from "@/components/ui/Card";
import { Sheet, SheetAction, SheetCancel } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import { useAddToLedger } from "@/features/shared/hooks";
import { ApiError, type ErrorCode, presentError } from "@/lib/api/errors";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { sumAmounts } from "@/lib/local/derive";
import { newEntityId } from "@/lib/local/outbox";
import { useOffline } from "@/lib/network/useOffline";

const SKIPPABLE = new Set<ErrorCode>(["SHARED_LINE_IN_LEDGER", "SHARED_LINE_NOT_PAID"]);

export interface LedgerLine {
  expenseId: string;
  description: string | null;
  date: string;
  amount: number;
}

export interface AddToLedgerSheetProps {
  open: boolean;
  groupId: string;
  owner: string;
  lines: LedgerLine[];
  onClose: () => void;
}

export function AddToLedgerSheet({ open, groupId, owner, lines, onClose }: AddToLedgerSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const dates = useDates();
  const toast = useToast();
  const offline = useOffline();
  const add = useAddToLedger();
  const [left, setLeft] = useState(lines);
  // One id per line for the life of the sheet: a retry after a lost answer replays, never adds twice.
  const [ids] = useState(() => new Map(lines.map((line) => [line.expenseId, newEntityId()])));
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [perLine, setPerLine] = useState<Record<string, string>>({});
  const total = sumAmounts(left.map((line) => line.amount));
  const categoryOf = (line: LedgerLine) => perLine[line.expenseId] ?? categoryId;
  const ready =
    !offline && accountId !== null && left.every((line) => categoryOf(line)) && !add.isPending;
  const error = add.error ? presentError(add.error) : null;
  const describe = (line: LedgerLine) => line.description ?? t("shared.joined.noDescription");

  async function save() {
    if (!ready) return;
    const remaining = [...left];
    const skipped: ApiError[] = [];
    try {
      for (const line of left) {
        try {
          await add.mutateAsync({
            id: ids.get(line.expenseId) ?? newEntityId(),
            groupId,
            expenseId: line.expenseId,
            accountId,
            categoryId: categoryOf(line),
          });
        } catch (error) {
          if (!(error instanceof ApiError && error.code && SKIPPABLE.has(error.code))) throw error;
          skipped.push(error);
        }
        remaining.shift();
      }
      const [first] = skipped;
      toast.show({
        message: t(first ? presentError(first).messageKey : "shared.joined.add.done"),
      });
      onClose();
    } catch {
      setLeft(remaining);
    }
  }

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      unsaved={accountId !== null || categoryId !== null}
      title={t("shared.joined.add.title")}
      footer={
        <>
          {error && <Alert tone="danger">{t(error.messageKey)}</Alert>}
          <SheetAction
            block
            disabled={!ready}
            loading={add.isPending}
            onClick={() => {
              void save();
            }}
          >
            {t("shared.joined.add.confirm", { amount: money.format(total) })}
          </SheetAction>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-2">
          {left.map((line) => (
            <div key={line.expenseId} className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-text-3">
                {t("shared.joined.add.line", {
                  description: describe(line),
                  date: dates.formatDay(new Date(line.date)),
                })}
              </span>
              <Amount value={line.amount} signed={false} />
            </div>
          ))}
        </Card>
        <AccountPicker
          label={t("shared.joined.add.account")}
          value={accountId}
          allowCreate={false}
          onChange={(account) => {
            setAccountId(account.id);
          }}
        />
        <div className="flex flex-col gap-3">
          <CategoryPicker
            type="EXPENSE"
            label={
              left.length === 1 && left[0]
                ? t("shared.joined.add.categoryFor", { description: describe(left[0]) })
                : t("shared.joined.add.category")
            }
            value={categoryId}
            allowCreate={false}
            onChange={(category) => {
              setCategoryId(category.id);
              setPerLine({});
            }}
          />
          {left.length > 1 &&
            left.map((line) => (
              <CategoryPicker
                key={line.expenseId}
                type="EXPENSE"
                label={t("shared.joined.add.categoryFor", { description: describe(line) })}
                value={categoryOf(line)}
                allowCreate={false}
                onChange={(category) => {
                  setPerLine((held) => ({ ...held, [line.expenseId]: category.id }));
                }}
              />
            ))}
        </div>
        <Alert tone="neutral" title={t("shared.joined.add.infoTitle")}>
          {t("shared.joined.add.infoBody", { owner })}
        </Alert>
        <p className="text-xs text-text-3">{t("shared.joined.add.foot", { owner })}</p>
        {offline && (
          <p role="status" className="text-xs text-text-2">
            {t("shared.joined.offline")}
          </p>
        )}
      </div>
    </Sheet>
  );
}
