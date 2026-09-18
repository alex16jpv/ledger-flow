"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { AccountCard, useAccountReading } from "@/components/ui/AccountCard";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { useUnsavedGuard } from "@/components/ui/Sheet";
import { SwatchGrid } from "@/components/ui/Swatch";
import { type DebtField, debtFieldOf } from "@/lib/accounts/debt";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { changedOnly, nothingChanged } from "@/lib/form/changes";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { randomColorToken } from "@/lib/theme/feature-color";
import type { Account } from "@/types/api";

import { useCreateAccount, useUpdateAccount } from "../hooks";
import { accountFormSchema, type AccountFormValues } from "../schemas";
import { AccountTypePicker } from "./AccountTypePicker";

// A type change leaves the other type's amount behind, and the server refuses to store it.
function orphanedFields(
  account: Account,
  carried: DebtField | null,
): Partial<Record<DebtField, null>> {
  const orphaned: Partial<Record<DebtField, null>> = {};
  if (account.creditLimit !== undefined && carried !== "creditLimit") orphaned.creditLimit = null;
  if (account.borrowedAmount !== undefined && carried !== "borrowedAmount") {
    orphaned.borrowedAmount = null;
  }
  return orphaned;
}

interface AccountFormProps {
  account?: Account;
  onSaved: (account: Account) => void;
  submitLabel: string;
  onCancel?: () => void;
  secondaryAction?: ReactNode;
}

export function AccountForm({
  account,
  onSaved,
  submitLabel,
  onCancel,
  secondaryAction,
}: AccountFormProps) {
  const t = useTranslations();
  const create = useCreateAccount();
  const update = useUpdateAccount(account?.id ?? "");
  const mutation = account ? update : create;
  const [suggestedColor] = useState(() => randomColorToken());
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type,
          balance: null,
          creditLimit: account.creditLimit ?? null,
          borrowedAmount: account.borrowedAmount ?? null,
          color: account.color ?? "BLUE",
        }
      : {
          name: "",
          type: "ACCOUNT",
          balance: null,
          creditLimit: null,
          borrowedAmount: null,
          color: suggestedColor,
        },
  });
  // Read during render: `formState` is a Proxy that only tracks what the component subscribed to.
  const { errors, dirtyFields, isDirty } = form.formState;
  useUnsavedGuard(isDirty);
  const serverFields = fieldErrors(mutation.error);
  const failure = mutation.error;
  const duplicate = failure instanceof ApiError && failure.code === "DUPLICATE";
  const formError =
    failure && !duplicate && Object.keys(serverFields).length === 0 ? presentError(failure) : null;
  const [name, type, color, balance, creditLimit, borrowedAmount] = useWatch({
    control: form.control,
    name: ["name", "type", "color", "balance", "creditLimit", "borrowedAmount"],
  });
  const debtField = debtFieldOf(type);
  const typed = balance ?? 0;
  const preview = useAccountReading({
    type,
    balance: account ? account.balance : debtField === null ? typed : -typed,
    creditLimit: debtField === "creditLimit" ? (creditLimit ?? undefined) : undefined,
    borrowedAmount: debtField === "borrowedAmount" ? (borrowedAmount ?? undefined) : undefined,
  });

  const submit = form.handleSubmit(async (values) => {
    const carried = debtFieldOf(values.type);
    try {
      if (account) {
        const changes = changedOnly(
          {
            name: values.name,
            type: values.type,
            color: values.color,
            creditLimit: carried === "creditLimit" ? values.creditLimit : null,
            borrowedAmount: carried === "borrowedAmount" ? values.borrowedAmount : null,
          },
          dirtyFields,
        );
        // The server refuses a type change that orphans an amount, so the same write clears it.
        const orphaned = orphanedFields(account, carried);
        const write = { ...changes, ...orphaned };
        onSaved(nothingChanged(write) ? account : await update.mutateAsync(write));
        return;
      }
      const typed = values.balance ?? 0;
      onSaved(
        await create.mutateAsync({
          name: values.name,
          type: values.type,
          color: values.color,
          balance: carried === null ? typed : -typed,
          ...(carried === "creditLimit" && values.creditLimit !== null
            ? { creditLimit: values.creditLimit }
            : {}),
          ...(carried === "borrowedAmount" && values.borrowedAmount !== null
            ? { borrowedAmount: values.borrowedAmount }
            : {}),
        }),
      );
    } catch {
      return;
    }
  });

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-3">
        <Field
          label={t("accounts.form.name")}
          error={
            duplicate
              ? t("accounts.form.duplicate", { name: form.getValues("name").trim() })
              : validationMessage(t, errors.name?.message ?? serverFields.name)
          }
        >
          <Input
            placeholder={t("accounts.form.namePlaceholder")}
            autoComplete="off"
            leading={<Landmark {...iconProps("sm")} />}
            {...form.register("name")}
          />
        </Field>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <AccountTypePicker
              value={field.value}
              onChange={field.onChange}
              label={t("accounts.form.type")}
              error={validationMessage(t, errors.type?.message)}
            />
          )}
        />
        {debtField !== null && !account && (
          <Controller
            control={form.control}
            name="balance"
            render={({ field }) => (
              <Field
                label={t("accounts.form.owed")}
                help={t("accounts.form.owedHelp")}
                error={validationMessage(t, errors.balance?.message ?? serverFields.balance)}
              >
                <Card className="p-0">
                  <AmountInput
                    label={t("accounts.form.owed")}
                    defaultValue={field.value}
                    onChange={field.onChange}
                    className="py-3.5"
                  />
                </Card>
              </Field>
            )}
          />
        )}
        {debtField !== null && (
          <Controller
            control={form.control}
            name={debtField}
            render={({ field }) => (
              <Field
                label={t(`accounts.form.${debtField}`)}
                optional
                help={t(`accounts.form.${debtField}Help`)}
                error={validationMessage(t, errors[debtField]?.message ?? serverFields[debtField])}
              >
                <Card className="p-0">
                  <AmountInput
                    label={t(`accounts.form.${debtField}`)}
                    defaultValue={field.value}
                    onChange={field.onChange}
                    className="py-3.5"
                  />
                </Card>
              </Field>
            )}
          />
        )}
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <Field
              label={t("accounts.form.color")}
              error={validationMessage(t, errors.color?.message)}
            >
              <SwatchGrid
                value={field.value}
                onChange={field.onChange}
                label={t("accounts.form.color")}
              />
            </Field>
          )}
        />
        {debtField === null && !account && (
          <Controller
            control={form.control}
            name="balance"
            render={({ field }) => (
              <Field
                label={t("accounts.form.balance")}
                optional
                help={t("accounts.form.balanceHelp")}
                error={validationMessage(t, errors.balance?.message ?? serverFields.balance)}
              >
                <Card className="p-0">
                  <AmountInput
                    label={t("accounts.form.balance")}
                    defaultValue={field.value}
                    onChange={field.onChange}
                    className="py-3.5"
                  />
                </Card>
              </Field>
            )}
          />
        )}
        <AccountCard
          name={name.trim() || t("accounts.form.previewName")}
          typeLabel={`${t(`accountTypes.${type}`)} · ${t("accounts.form.preview")}`}
          balance={<Amount value={preview.lead} signed={false} size="lg" />}
          color={color}
          mainLabel={account?.isDefault ? t("common.main") : undefined}
          debt={preview.debt}
        />
      </div>
      <div className="flex flex-col gap-2">
        {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
        <Button type="submit" size="lg" block loading={mutation.isPending}>
          {submitLabel}
        </Button>
        {secondaryAction}
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" block onClick={onCancel}>
            {t("common.backToList")}
          </Button>
        )}
      </div>
    </form>
  );
}
