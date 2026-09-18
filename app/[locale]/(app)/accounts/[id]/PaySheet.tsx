"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import { TransferReadback } from "@/features/transactions/components/TransferReadback";
import { useCreateTransaction } from "@/features/transactions/hooks";
import { mayHoldOwnMoney } from "@/lib/accounts/debt";
import { presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Account, CreateTransactionInput } from "@/types/api";

export interface PaySheetProps {
  account: Account;
  main: Account | undefined;
  open: boolean;
  onClose: () => void;
}

export function payInput(
  account: Pick<Account, "id">,
  from: Account | null,
  amount: number,
  categoryId: string | null,
  outsideDescription: string,
  now = new Date(),
): CreateTransactionInput {
  const common = { amount, date: now.toISOString(), toAccountId: account.id };
  if (from === null) {
    return {
      ...common,
      type: "ADJUSTMENT",
      fromAccountId: null,
      categoryId: null,
      description: outsideDescription,
    };
  }
  return { ...common, type: "TRANSFER", fromAccountId: from.id, categoryId };
}

export function PaySheet({ account, main, open, onClose }: PaySheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const create = useCreateTransaction();
  const keyring = useRef(new IdempotencyKeyring());
  const owed = Math.max(0, -account.balance);
  const capped = !mayHoldOwnMoney(account.type);
  const [amount, setAmount] = useState<number | null>(owed);
  // The main account can be the very account being paid, and nothing is paid with itself.
  const [from, setFrom] = useState<Account | null>(main?.id === account.id ? null : (main ?? null));
  const [openedAt] = useState(() => new Date());
  const [outside, setOutside] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const error = create.error ? presentError(create.error) : null;
  const over = capped && amount !== null && amount > owed;
  const ready = amount !== null && amount > 0 && !over && (outside || from !== null);

  async function pay() {
    if (!ready) return;
    const input = payInput(
      account,
      outside ? null : from,
      amount,
      categoryId,
      t("accounts.pay.outsideDescription"),
      openedAt,
    );
    try {
      await create.mutateAsync({ input, idempotencyKey: keyring.current.keyFor(input) });
      toast.show({ message: t("accounts.pay.paid") });
      onClose();
    } catch {
      return;
    }
  }

  const readBack =
    amount === null || amount <= 0 || over ? null : (
      <TransferReadback
        from={outside ? null : from}
        to={account}
        amount={amount}
        outside={outside}
      />
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      unsaved={amount !== null && amount !== owed}
      title={t("accounts.pay.title", { name: account.name })}
      footer={
        <>
          {error && <Alert tone="danger">{t(error.messageKey)}</Alert>}
          <Button
            size="lg"
            block
            disabled={!ready}
            loading={create.isPending}
            onClick={() => {
              void pay();
            }}
          >
            {t("accounts.pay.pay")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("accounts.pay.amount")}
          error={over ? t("accounts.pay.overLoan", { amount: money.format(owed) }) : undefined}
        >
          <Card className="flex flex-col gap-2 p-0 pb-3">
            <AmountInput
              label={t("accounts.pay.amount")}
              defaultValue={owed}
              onChange={setAmount}
              autoFocus
              invalid={over}
              className="py-4"
            />
            <div className="mx-auto flex gap-2">
              <Chip
                selected={amount === owed}
                onClick={() => {
                  setAmount(owed);
                }}
              >
                {t("accounts.pay.everything")}
              </Chip>
              <Chip
                selected={amount !== owed}
                onClick={() => {
                  setAmount(null);
                }}
              >
                {t("accounts.pay.another")}
              </Chip>
            </div>
          </Card>
        </Field>
        <AccountPicker
          label={t("accounts.pay.from")}
          value={outside ? null : (from?.id ?? null)}
          exclude={account.id}
          allowCreate={false}
          onChange={(chosen) => {
            setOutside(false);
            setFrom(chosen);
          }}
          outside={{
            label: t("accounts.pay.outside"),
            meta: t("accounts.pay.outsideMeta"),
            selected: outside,
            onSelect: () => {
              setOutside(true);
              setFrom(null);
            },
          }}
        />
        {!outside && (
          <CategoryPicker
            type="TRANSFER"
            value={categoryId}
            allowCreate={false}
            onChange={(category) => {
              setCategoryId(category.id);
            }}
          />
        )}
        {readBack}
      </div>
    </Sheet>
  );
}
