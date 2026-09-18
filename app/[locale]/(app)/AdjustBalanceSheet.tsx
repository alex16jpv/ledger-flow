"use client";

import { Scale, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Segment } from "@/components/ui/Segment";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useAccountQuery } from "@/features/accounts/hooks";
import {
  adjustmentAccountId,
  type AdjustmentDirection,
  directionOf,
} from "@/features/transactions/adjustments";
import { DeleteTransactionSheet } from "@/features/transactions/components/DeleteTransactionSheet";
import { TEXT_MAX } from "@/features/transactions/form";
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from "@/features/transactions/hooks";
import { debtFieldOf } from "@/lib/accounts/debt";
import { presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { nothingChanged } from "@/lib/form/changes";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import type {
  Account,
  CreateTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from "@/types/api";

type Sign = "positive" | "negative";

export interface AdjustBalanceSheetProps {
  account: Account;
  open: boolean;
  onClose: () => void;
}

// The design asks for the delta on screen: actual minus recorded, rounded to the currency. The server still books it.
export function adjustmentInput(
  account: Pick<Account, "id" | "balance">,
  actual: number,
  note: string,
  round: (amount: number) => number,
  now = new Date(),
): CreateTransactionInput | null {
  const delta = round(actual - account.balance);
  if (delta === 0) return null;
  return {
    type: "ADJUSTMENT",
    amount: Math.abs(delta),
    date: now.toISOString(),
    fromAccountId: delta < 0 ? account.id : null,
    toAccountId: delta > 0 ? account.id : null,
    categoryId: null,
    note: note.trim() || null,
  };
}

export function adjustmentChanges(
  adjustment: Pick<Transaction, "amount" | "note" | "toAccountId">,
  account: Pick<Account, "id">,
  amount: number,
  direction: AdjustmentDirection,
  note: string,
): UpdateTransactionInput {
  const trimmed = note.trim() || null;
  return {
    ...(amount === adjustment.amount ? {} : { amount }),
    ...(direction === directionOf(adjustment)
      ? {}
      : {
          fromAccountId: direction === "decrease" ? account.id : null,
          toAccountId: direction === "increase" ? account.id : null,
        }),
    ...(trimmed === (adjustment.note ?? null) ? {} : { note: trimmed }),
  };
}

export function AdjustBalanceSheet({ account, open, onClose }: AdjustBalanceSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const create = useCreateTransaction();
  const keyring = useRef(new IdempotencyKeyring());
  const field = debtFieldOf(account.type);
  const isDebt = field !== null;
  // A loan cannot hold money of its owner, so the only amount it can be asked for is the debt.
  const isLoan = field === "borrowedAmount";
  const preset = isLoan ? Math.max(0, -account.balance) : Math.abs(account.balance);
  const [magnitude, setMagnitude] = useState<number | null>(preset);
  const [sign, setSign] = useState<Sign>(!isLoan && account.balance > 0 ? "positive" : "negative");
  const [note, setNote] = useState("");
  const [openedAt] = useState(() => new Date());
  const actual = magnitude === null ? null : sign === "negative" ? -magnitude : magnitude;
  const label = isDebt
    ? t(sign === "negative" ? "accounts.adjust.owed" : "accounts.adjust.mine", {
        name: account.name,
      })
    : t("accounts.adjust.actual", { name: account.name });
  const input =
    actual === null ? null : adjustmentInput(account, actual, note, money.round, openedAt);
  const delta = actual === null ? null : money.round(actual - account.balance);
  // A debt account can hold money of your own, and then there is no debt to say less or more of.
  const debtGrammar = isDebt && account.balance <= 0 && (actual ?? 0) <= 0;
  const error = create.error ? presentError(create.error) : null;

  async function save() {
    if (!input) return;
    try {
      await create.mutateAsync({ input, idempotencyKey: keyring.current.keyFor(input) });
      toast.show({ message: t("accounts.adjust.saved") });
      onClose();
    } catch {
      return;
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      unsaved={input !== null || note !== ""}
      title={t("accounts.adjust.title")}
      footer={
        <>
          {error && <Alert tone="danger">{t(error.messageKey)}</Alert>}
          <Button
            size="lg"
            block
            disabled={!input}
            loading={create.isPending}
            onClick={() => {
              void save();
            }}
          >
            {t("accounts.adjust.save")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={label}>
          <Card className="flex flex-col gap-2 p-0 pb-3">
            <AmountInput
              label={label}
              defaultValue={preset}
              onChange={setMagnitude}
              autoFocus
              className="py-4"
            />
            {!isLoan && (
              <Segment<Sign>
                inline
                label={t(isDebt ? "accounts.adjust.side" : "accounts.adjust.sign")}
                value={sign}
                onChange={setSign}
                options={
                  isDebt
                    ? [
                        { value: "negative", label: t("accounts.adjust.sideOwed") },
                        { value: "positive", label: t("accounts.adjust.sideMine") },
                      ]
                    : [
                        { value: "positive", label: t("accounts.adjust.positive") },
                        { value: "negative", label: t("accounts.adjust.negative") },
                      ]
                }
                className="mx-auto"
              />
            )}
          </Card>
        </Field>
        <p className="text-center text-sm text-text-3">
          {isDebt
            ? t(
                account.balance > 0
                  ? "accounts.adjust.recordedMine"
                  : "accounts.adjust.recordedOwed",
                { amount: money.format(Math.abs(account.balance)) },
              )
            : t("accounts.adjust.recorded", { amount: money.format(account.balance) })}
        </p>
        {delta === null ? null : delta === 0 ? (
          <Alert tone="neutral">{t("accounts.adjust.noChange")}</Alert>
        ) : (
          <Alert tone="info">
            {t.rich(
              debtGrammar
                ? delta > 0
                  ? "accounts.adjust.deltaLessOwed"
                  : "accounts.adjust.deltaMoreOwed"
                : "accounts.adjust.delta",
              {
                amount: debtGrammar
                  ? money.format(Math.abs(delta))
                  : (delta < 0 ? "−" : "+") + money.format(Math.abs(delta)),
                b: (chunks) => <b className="font-semibold">{chunks}</b>,
              },
            )}
          </Alert>
        )}
        <Field label={t("accounts.adjust.note")} optional>
          <Input
            value={note}
            maxLength={TEXT_MAX}
            placeholder={t("accounts.adjust.notePlaceholder")}
            autoComplete="off"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </Field>
      </div>
    </Sheet>
  );
}

export interface EditAdjustmentSheetProps {
  adjustment: Transaction;
  open: boolean;
  onClose: () => void;
}

export function EditAdjustmentSheet({ adjustment, open, onClose }: EditAdjustmentSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const dates = useDates();
  const toast = useToast();
  const update = useUpdateTransaction(adjustment.id);
  const remove = useDeleteTransaction();
  const accountId = adjustmentAccountId(adjustment) ?? "";
  const account = useAccountQuery(accountId, accountId !== "").data;
  const [amount, setAmount] = useState<number | null>(adjustment.amount);
  const [direction, setDirection] = useState<AdjustmentDirection>(directionOf(adjustment));
  const [note, setNote] = useState(adjustment.note ?? "");
  const [confirming, setConfirming] = useState(false);
  const error = update.error ? presentError(update.error) : null;
  const changes =
    amount === null || amount <= 0 || !account
      ? null
      : adjustmentChanges(adjustment, account, amount, direction, note);

  async function save() {
    if (!changes) return;
    try {
      if (!nothingChanged(changes)) await update.mutateAsync(changes);
      toast.show({ message: t("accounts.adjust.updated") });
      onClose();
    } catch {
      return;
    }
  }

  async function confirmDelete() {
    try {
      await remove.mutateAsync(adjustment.id);
      toast.show({ message: t("transactions.form.deleted") });
      onClose();
    } catch (caught) {
      toast.show({ message: t(presentError(caught).messageKey), tone: "danger" });
      setConfirming(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        unsaved={changes !== null && !nothingChanged(changes)}
        title={t("accounts.adjust.editTitle")}
        footer={
          <>
            {error && <Alert tone="danger">{t(error.messageKey)}</Alert>}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setConfirming(true);
                }}
              >
                <Trash2 {...iconProps("sm")} />
                {t("common.delete")}
              </Button>
              <Button
                size="lg"
                className="flex-[1.4]"
                disabled={changes === null}
                loading={update.isPending}
                onClick={() => {
                  void save();
                }}
              >
                {t("common.saveChanges")}
              </Button>
            </div>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2 p-0 pb-3">
            <Segment<AdjustmentDirection>
              inline
              label={t("transactions.form.direction")}
              value={direction}
              onChange={setDirection}
              options={[
                { value: "increase", label: t("transactions.form.increase"), tone: "income" },
                { value: "decrease", label: t("transactions.form.decrease") },
              ]}
              className="mx-auto mt-3"
            />
            <AmountInput
              label={t("accounts.adjust.amount")}
              defaultValue={adjustment.amount}
              onChange={setAmount}
              autoFocus
              className="py-4"
            />
          </Card>
          {account && (
            <Alert tone="neutral" icon={Scale}>
              {t(
                directionOf(adjustment) === "decrease"
                  ? "accounts.adjust.editTook"
                  : "accounts.adjust.editAdded",
                {
                  date: dates.formatDay(new Date(adjustment.date)),
                  amount:
                    (directionOf(adjustment) === "decrease" ? "−" : "+") +
                    money.format(adjustment.amount),
                  name: account.name,
                },
              )}
            </Alert>
          )}
          <Field label={t("accounts.adjust.note")} optional>
            <Input
              value={note}
              maxLength={TEXT_MAX}
              placeholder={t("accounts.adjust.notePlaceholder")}
              autoComplete="off"
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          </Field>
        </div>
      </Sheet>
      <DeleteTransactionSheet
        open={confirming}
        pending={remove.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
        onClose={() => {
          setConfirming(false);
        }}
      />
    </>
  );
}
