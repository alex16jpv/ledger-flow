"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { AccountCard } from "@/components/ui/AccountCard";
import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { SwatchGrid } from "@/components/ui/Swatch";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { validationMessage } from "@/lib/i18n/validation";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { useCreateAccount, useUpdateAccount } from "../hooks";
import { ACCOUNT_TYPES, accountFormSchema, type AccountFormValues } from "../schemas";

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
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? { name: account.name, type: account.type, balance: null, color: account.color ?? "BLUE" }
      : { name: "", type: "ACCOUNT", balance: null, color: "BLUE" },
  });
  const { errors } = form.formState;
  const serverFields = fieldErrors(mutation.error);
  const failure = mutation.error;
  const duplicate = failure instanceof ApiError && failure.code === "DUPLICATE";
  const formError =
    failure && !duplicate && Object.keys(serverFields).length === 0 ? presentError(failure) : null;
  const [name, type, color, balance] = useWatch({
    control: form.control,
    name: ["name", "type", "color", "balance"],
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      onSaved(
        account
          ? await update.mutateAsync({ name: values.name, type: values.type, color: values.color })
          : await create.mutateAsync({
              name: values.name,
              type: values.type,
              color: values.color,
              balance: values.balance ?? 0,
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
            <Field
              label={t("accounts.form.type")}
              error={validationMessage(t, errors.type?.message)}
            >
              <ChipRow
                role="group"
                aria-label={t("accounts.form.type")}
                className="flex-wrap overflow-visible"
              >
                {ACCOUNT_TYPES.map((option) => {
                  const Icon = accountTypeIcon(option);
                  return (
                    <Chip
                      key={option}
                      selected={field.value === option}
                      icon={<Icon {...iconProps("sm")} />}
                      onClick={() => {
                        field.onChange(option);
                      }}
                    >
                      {t(`accountTypes.${option}`)}
                    </Chip>
                  );
                })}
              </ChipRow>
            </Field>
          )}
        />
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
        {!account && (
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
          balance={<Amount value={account?.balance ?? balance ?? 0} signed={false} size="lg" />}
          color={color}
          mainLabel={account?.isDefault ? t("common.main") : undefined}
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
