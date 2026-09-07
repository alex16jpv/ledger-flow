"use client";

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
import { TEXT_MAX } from "@/features/transactions/form";
import { useCreateTransaction } from "@/features/transactions/hooks";
import { presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Account, CreateTransactionInput } from "@/types/api";

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

export function AdjustBalanceSheet({ account, open, onClose }: AdjustBalanceSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const create = useCreateTransaction();
  const keyring = useRef(new IdempotencyKeyring());
  const [magnitude, setMagnitude] = useState<number | null>(Math.abs(account.balance));
  const [sign, setSign] = useState<Sign>(account.balance < 0 ? "negative" : "positive");
  const [note, setNote] = useState("");
  const actual = magnitude === null ? null : sign === "negative" ? -magnitude : magnitude;
  const input = actual === null ? null : adjustmentInput(account, actual, note, money.round);
  const delta = actual === null ? null : money.round(actual - account.balance);
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
        <Field label={t("accounts.adjust.actual", { name: account.name })}>
          <Card className="flex flex-col gap-2 p-0 pb-3">
            <AmountInput
              label={t("accounts.adjust.actual", { name: account.name })}
              defaultValue={Math.abs(account.balance)}
              onChange={setMagnitude}
              autoFocus
              className="py-4"
            />
            <Segment<Sign>
              inline
              label={t("accounts.adjust.sign")}
              value={sign}
              onChange={setSign}
              options={[
                { value: "positive", label: t("accounts.adjust.positive") },
                { value: "negative", label: t("accounts.adjust.negative") },
              ]}
              className="mx-auto"
            />
          </Card>
        </Field>
        <p className="text-center text-sm text-text-3">
          {t("accounts.adjust.recorded", { amount: money.format(account.balance) })}
        </p>
        {delta === null ? null : delta === 0 ? (
          <Alert tone="neutral">{t("accounts.adjust.noChange")}</Alert>
        ) : (
          <Alert tone="info">
            {t.rich("accounts.adjust.delta", {
              amount: (delta < 0 ? "−" : "+") + money.format(Math.abs(delta)),
              b: (chunks) => <b className="font-semibold">{chunks}</b>,
            })}
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
