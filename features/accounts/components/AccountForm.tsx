"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ellipsis, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { type PickerOption, PickerSheet } from "@/components/ui/PickerSheet";
import { SwatchGrid } from "@/components/ui/Swatch";
import { Tile } from "@/components/ui/Tile";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { validationMessage } from "@/lib/i18n/validation";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { useCreateAccount } from "../hooks";
import {
  ACCOUNT_TYPES,
  accountFormSchema,
  type AccountFormValues,
  type AccountType,
} from "../schemas";

const QUICK_TYPES: readonly AccountType[] = ["ACCOUNT", "CASH", "DEBIT_CARD", "CARD", "SAVINGS"];

interface AccountFormProps {
  onCreated: (account: Account) => void;
  submitLabel: string;
}

export function AccountForm({ onCreated, submitLabel }: AccountFormProps) {
  const t = useTranslations();
  const createAccount = useCreateAccount();
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { name: "", type: "ACCOUNT", balance: null, color: "BLUE" },
  });
  const { errors } = form.formState;
  const serverFields = fieldErrors(createAccount.error);
  const failure = createAccount.error;
  const duplicate = failure instanceof ApiError && failure.code === "DUPLICATE";
  const formError =
    failure && !duplicate && Object.keys(serverFields).length === 0 ? presentError(failure) : null;

  const submit = form.handleSubmit(async ({ name, type, balance, color }) => {
    try {
      onCreated(await createAccount.mutateAsync({ name, type, color, balance: balance ?? 0 }));
    } catch {
      return;
    }
  });

  const typeOptions: PickerOption<AccountType>[] = ACCOUNT_TYPES.map((type) => {
    const Icon = accountTypeIcon(type);
    return {
      value: type,
      label: t(`accountTypes.${type}`),
      leading: (
        <Tile size="sm">
          <Icon {...iconProps("sm")} />
        </Tile>
      ),
    };
  });

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
      <div className="flex flex-col gap-3">
        <Field
          label={t("accounts.form.name")}
          error={
            duplicate
              ? t("errors.DUPLICATE")
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
          render={({ field }) => {
            const visible = QUICK_TYPES.includes(field.value)
              ? QUICK_TYPES
              : [...QUICK_TYPES, field.value];
            return (
              <Field
                label={t("accounts.form.type")}
                error={validationMessage(t, errors.type?.message)}
              >
                <ChipRow role="group" aria-label={t("accounts.form.type")}>
                  {visible.map((type) => {
                    const Icon = accountTypeIcon(type);
                    return (
                      <Chip
                        key={type}
                        selected={field.value === type}
                        icon={<Icon {...iconProps("sm")} />}
                        onClick={() => {
                          field.onChange(type);
                        }}
                      >
                        {t(`accountTypes.${type}`)}
                      </Chip>
                    );
                  })}
                  <Chip
                    icon={<Ellipsis {...iconProps("sm")} />}
                    onClick={() => {
                      setTypePickerOpen(true);
                    }}
                  >
                    {t("common.more")}
                  </Chip>
                </ChipRow>
                <PickerSheet
                  open={typePickerOpen}
                  onClose={() => {
                    setTypePickerOpen(false);
                  }}
                  title={t("accounts.form.type")}
                  options={typeOptions}
                  value={field.value}
                  onSelect={field.onChange}
                  searchable={false}
                />
              </Field>
            );
          }}
        />
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
      </div>
      <Button type="submit" size="lg" block loading={createAccount.isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}
