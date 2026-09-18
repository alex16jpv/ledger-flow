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
import { useCategoriesQuery } from "@/features/categories/hooks";
import { InstalmentReadback } from "@/features/transactions/components/InstalmentReadback";
import { TransferReadback } from "@/features/transactions/components/TransferReadback";
import { useCreateTransaction } from "@/features/transactions/hooks";
import { mayHoldOwnMoney } from "@/lib/accounts/debt";
import { presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { useMoney } from "@/lib/i18n/useMoney";
import { fromCents, toCents } from "@/lib/local/derive/money";
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

export function interestInput(
  from: Pick<Account, "id">,
  amount: number,
  categoryId: string,
  description: string,
  now = new Date(),
): CreateTransactionInput {
  return {
    type: "EXPENSE",
    amount,
    date: now.toISOString(),
    fromAccountId: from.id,
    toAccountId: null,
    categoryId,
    description,
  };
}

export function PaySheet({ account, main, open, onClose }: PaySheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const toast = useToast();
  const create = useCreateTransaction();
  const keyring = useRef(new IdempotencyKeyring());
  const owed = Math.max(0, -account.balance);
  const capped = !mayHoldOwnMoney(account.type);
  const [amount, setAmount] = useState<number | null>(null);
  const [interest, setInterest] = useState<number | null>(null);
  const [chosenInterestCategory, setChosenInterestCategory] = useState<string | null>(null);
  const [paidPrincipal, setPaidPrincipal] = useState(false);
  // The main account can be the very account being paid, and nothing is paid with itself.
  const [from, setFrom] = useState<Account | null>(main?.id === account.id ? null : (main ?? null));
  const [openedAt] = useState(() => new Date());
  const [outside, setOutside] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const error = create.error ? presentError(create.error) : null;
  const instalment = account.type === "LOAN" && !outside;
  const splits = instalment && interest !== null && interest > 0;
  const expenses = useCategoriesQuery("EXPENSE", instalment);
  const seededInterest = (expenses.data ?? []).find((category) => category.seedKey === "interest");
  const interestCategory = seededInterest?.id ?? chosenInterestCategory;
  const interestCategoryName =
    seededInterest?.name ??
    (expenses.data ?? []).find((category) => category.id === chosenInterestCategory)?.name ??
    "";
  // Two figures the user typed, split in minor units: a subtraction in majors loses cents (§2).
  const principal =
    splits && amount !== null ? fromCents(toCents(amount) - toCents(interest)) : amount;
  const allInterest = splits && principal !== null && principal <= 0;
  const over = capped && principal !== null && principal > owed;
  const ready =
    amount !== null &&
    amount > 0 &&
    !over &&
    !allInterest &&
    (!splits || interestCategory !== null) &&
    (outside || from !== null);

  async function pay() {
    if (!ready || principal === null) return;
    const input = payInput(
      account,
      outside ? null : from,
      principal,
      categoryId,
      t("accounts.pay.outsideDescription"),
      openedAt,
    );
    try {
      if (!paidPrincipal) {
        await create.mutateAsync({ input, idempotencyKey: keyring.current.keyFor(input) });
        if (splits) setPaidPrincipal(true);
      }
      if (splits && from !== null && interestCategory !== null) {
        const expense = interestInput(
          from,
          interest,
          interestCategory,
          t("accounts.pay.interestDescription", { name: account.name }),
          openedAt,
        );
        await create.mutateAsync({
          input: expense,
          idempotencyKey: keyring.current.keyFor(expense),
        });
      }
      toast.show({ message: t("accounts.pay.paid") });
      onClose();
    } catch {
      return;
    }
  }

  const readBack =
    amount === null || amount <= 0 || over || allInterest ? null : splits && from !== null ? (
      <InstalmentReadback
        from={from}
        to={account}
        instalment={amount}
        interest={interest}
        interestCategory={interestCategoryName}
        transfer={paidPrincipal ? "saved" : "pending"}
        expense={paidPrincipal ? "refused" : "pending"}
      />
    ) : (
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
      unsaved={amount !== null}
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
            {t(paidPrincipal ? "accounts.pay.sendAgain" : "accounts.pay.pay")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset disabled={paidPrincipal} className="flex min-w-0 flex-col gap-4 border-0 p-0">
          <Field
            label={t("accounts.pay.amount")}
            error={over ? t("accounts.pay.overLoan", { amount: money.format(owed) }) : undefined}
          >
            <Card className="flex flex-col gap-2 p-0 pb-3">
              <AmountInput
                label={t("accounts.pay.amount")}
                value={amount}
                onChange={setAmount}
                autoFocus
                invalid={over}
                className="py-4"
              />
              <div className="mx-auto flex gap-2">
                <Chip
                  selected={principal === owed}
                  onClick={() => {
                    setAmount(
                      principal === owed ? null : fromCents(toCents(owed) + toCents(interest ?? 0)),
                    );
                  }}
                >
                  {t("accounts.pay.everything", { amount: money.format(owed) })}
                </Chip>
              </div>
            </Card>
          </Field>
          {instalment && (
            <Field
              label={t("accounts.pay.interest")}
              optional
              help={t("accounts.pay.interestHelp")}
              error={allInterest ? t("accounts.pay.interestOverAmount") : undefined}
            >
              <Card className="p-0 pb-1">
                <AmountInput
                  label={t("accounts.pay.interest")}
                  size="sm"
                  value={interest}
                  onChange={setInterest}
                  invalid={allInterest}
                  className="py-3"
                />
              </Card>
            </Field>
          )}
          {instalment && !expenses.isPending && seededInterest === undefined && (
            <div className="flex flex-col gap-1">
              <CategoryPicker
                type="EXPENSE"
                label={t("accounts.pay.interestCategory")}
                value={chosenInterestCategory}
                onChange={(category) => {
                  setChosenInterestCategory(category.id);
                }}
              />
              <span className="text-sm text-text-3">{t("accounts.pay.interestCategoryHelp")}</span>
            </div>
          )}
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
                setInterest(null);
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
        </fieldset>
        {readBack}
      </div>
    </Sheet>
  );
}
