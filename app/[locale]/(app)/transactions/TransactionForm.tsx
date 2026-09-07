"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Segment, type SegmentOption } from "@/components/ui/Segment";
import { TagsInput } from "@/components/ui/TagsInput";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import {
  type AdjustmentDirection,
  categoryAllowed,
  isTooFarAhead,
  toTransactionChanges,
  toTransactionInput,
  TRANSACTION_TYPES,
  transactionFormSchema,
  type TransactionFormValues,
  type TransactionType,
} from "@/features/transactions/form";
import { useTagsQuery } from "@/features/transactions/hooks";
import { fieldErrors, presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { dayKey, shiftDayKey } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { aheadOfServer, clockStore } from "@/lib/local/clock";
import type { CreateTransactionInput, UpdateTransactionInput } from "@/types/api";

const TYPE_TONE = {
  EXPENSE: "default",
  INCOME: "income",
  TRANSFER: "transfer",
  ADJUSTMENT: "adjustment",
} as const;

export interface TransactionFormProps {
  defaultValues: TransactionFormValues;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  // `changes` is the same input narrowed to the fields the user touched: an edit sends that, so a
  // note typed on one device does not travel as a new amount and a new date too (§1 example 3).
  onSubmit: (
    input: CreateTransactionInput,
    idempotencyKey: string,
    changes: UpdateTransactionInput,
  ) => Promise<unknown>;
  secondaryAction?: React.ReactNode;
}

export function TransactionForm({
  defaultValues,
  submitLabel,
  pending,
  error,
  onSubmit,
  secondaryAction,
}: TransactionFormProps) {
  const t = useTranslations();
  const { timeZone } = useFormatSettings();
  // F-66, the preventive half: the form's own guard uses this device's clock, so a device that runs
  // ahead accepts a date the server will refuse. The distance is only knowable from the server, and
  // the vault keeps it for exactly this moment.
  // The server refuses anything more than 24 h ahead, so the calendar stops there (7.28).
  const tomorrow = shiftDayKey(dayKey(new Date(), timeZone), 1);
  const skew = aheadOfServer(
    useSyncExternalStore(
      clockStore.subscribe,
      clockStore.getSnapshot,
      clockStore.getServerSnapshot,
    ),
  );
  const tags = useTagsQuery();
  const keyring = useRef(new IdempotencyKeyring());
  const amountInput = useRef<HTMLInputElement>(null);
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues,
  });
  // `dirtyFields` is read during render on purpose: React Hook Form's formState is a Proxy that only
  // tracks what the component subscribed to, and reading it for the first time inside the submit
  // handler would answer with an empty object.
  const { errors, dirtyFields } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  // The amount is the first thing to type on entering the form and after every type switch (owner request P-22).
  useEffect(() => {
    amountInput.current?.focus();
  }, [type]);
  const fromAccountId = useWatch({ control: form.control, name: "fromAccountId" });
  const toAccountId = useWatch({ control: form.control, name: "toAccountId" });
  const serverFields = fieldErrors(error);
  const formError = error && Object.keys(serverFields).length === 0 ? presentError(error) : null;
  const typeOptions: SegmentOption<TransactionType>[] = TRANSACTION_TYPES.map((value) => ({
    value,
    label: t(`transactionTypes.${value}`),
    tone: TYPE_TONE[value],
  }));
  const directionOptions: SegmentOption<AdjustmentDirection>[] = [
    { value: "increase", label: t("transactions.form.increase"), tone: "income" },
    { value: "decrease", label: t("transactions.form.decrease") },
  ];
  const accountError = validationMessage(
    t,
    errors.accountId?.message ?? serverFields.fromAccountId ?? serverFields.toAccountId,
  );

  async function save(values: TransactionFormValues) {
    if (isTooFarAhead(values, timeZone, new Date())) {
      form.setError("date", { message: "validation.futureDate" });
      return;
    }
    const input = toTransactionInput(values, timeZone);
    try {
      await onSubmit(
        input,
        keyring.current.keyFor(input),
        toTransactionChanges(input, dirtyFields),
      );
    } catch {
      return;
    }
  }

  function changeType(next: TransactionType) {
    // `shouldDirty` because an edit only sends what is dirty: a value the screen sets on the user's
    // behalf is still the user's change.
    form.setValue("type", next, { shouldDirty: true });
    if (!categoryAllowed(next)) form.setValue("categoryId", null, { shouldDirty: true });
    form.clearErrors();
  }

  return (
    <form
      onSubmit={(event) => {
        void form.handleSubmit(save)(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
      <Segment
        options={typeOptions}
        value={type}
        onChange={changeType}
        label={t("transactions.form.type")}
      />
      <Controller
        control={form.control}
        name="amount"
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <AmountInput
              ref={amountInput}
              label={t("transactions.form.amount")}
              defaultValue={Number.isFinite(field.value) ? field.value : null}
              onChange={(value) => {
                field.onChange(value ?? Number.NaN);
              }}
              invalid={Boolean(errors.amount) || Boolean(serverFields.amount)}
              className="py-2"
            />
            {(errors.amount ?? serverFields.amount) && (
              <span role="alert" className="text-center text-sm text-danger">
                {validationMessage(t, errors.amount?.message ?? serverFields.amount)}
              </span>
            )}
          </div>
        )}
      />
      {type === "ADJUSTMENT" && (
        <Alert tone="neutral">{t("transactions.form.adjustmentHint")}</Alert>
      )}
      {categoryAllowed(type) && (
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <CategoryPicker
                type={type}
                value={field.value}
                onChange={(category) => {
                  field.onChange(category.id);
                }}
                label={t("transactions.form.category")}
              />
              {serverFields.categoryId && (
                <span role="alert" className="text-sm text-danger">
                  {validationMessage(t, serverFields.categoryId)}
                </span>
              )}
            </div>
          )}
        />
      )}
      {type === "TRANSFER" ? (
        <div className="flex flex-col gap-2">
          <Controller
            control={form.control}
            name="fromAccountId"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <AccountPicker
                  label={t("transactions.form.from")}
                  value={field.value}
                  exclude={toAccountId}
                  onChange={(account) => {
                    field.onChange(account.id);
                  }}
                />
                {(errors.fromAccountId ?? serverFields.fromAccountId) && (
                  <span role="alert" className="text-sm text-danger">
                    {validationMessage(
                      t,
                      errors.fromAccountId?.message ?? serverFields.fromAccountId,
                    )}
                  </span>
                )}
              </div>
            )}
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              round
              aria-label={t("transactions.form.swap")}
              onClick={() => {
                form.setValue("fromAccountId", toAccountId, { shouldDirty: true });
                form.setValue("toAccountId", fromAccountId, { shouldDirty: true });
              }}
            >
              <ArrowUpDown {...iconProps("sm")} />
            </Button>
          </div>
          <Controller
            control={form.control}
            name="toAccountId"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <AccountPicker
                  label={t("transactions.form.to")}
                  value={field.value}
                  exclude={fromAccountId}
                  onChange={(account) => {
                    field.onChange(account.id);
                  }}
                />
                {(errors.toAccountId ?? serverFields.toAccountId) && (
                  <span role="alert" className="text-sm text-danger">
                    {validationMessage(t, errors.toAccountId?.message ?? serverFields.toAccountId)}
                  </span>
                )}
              </div>
            )}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Controller
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <AccountPicker
                  label={t("transactions.form.account")}
                  value={field.value}
                  onChange={(account) => {
                    field.onChange(account.id);
                  }}
                />
                {accountError && (
                  <span role="alert" className="text-sm text-danger">
                    {accountError}
                  </span>
                )}
              </div>
            )}
          />
          {type === "ADJUSTMENT" && (
            <Controller
              control={form.control}
              name="direction"
              render={({ field }) => (
                <Segment
                  options={directionOptions}
                  value={field.value}
                  onChange={field.onChange}
                  label={t("transactions.form.direction")}
                />
              )}
            />
          )}
        </div>
      )}
      {skew && (
        <Alert tone="warning">
          {t(
            skew.unit === "days"
              ? "transactions.form.clockSkew.days"
              : "transactions.form.clockSkew.hours",
            { count: skew.count },
          )}{" "}
          {t("transactions.form.clockSkew.refused")}
        </Alert>
      )}
      <Controller
        control={form.control}
        name="date"
        render={({ field }) => (
          <Controller
            control={form.control}
            name="time"
            render={({ field: timeField }) => (
              <DateTimeField
                value={{ date: field.value, time: timeField.value }}
                onChange={(next) => {
                  field.onChange(next.date);
                  timeField.onChange(next.time);
                  form.clearErrors("date");
                }}
                dateLabel={t("common.date")}
                timeLabel={t("common.time")}
                max={tomorrow}
                dateNote={t("transactions.form.dateLimit")}
                dateError={validationMessage(t, errors.date?.message ?? serverFields.date)}
              />
            )}
          />
        )}
      />
      <Field
        label={t("transactions.form.description")}
        optional
        error={validationMessage(t, errors.description?.message ?? serverFields.description)}
      >
        <Input
          placeholder={t("transactions.form.descriptionPlaceholder")}
          autoComplete="off"
          maxLength={255}
          leading={<PencilLine {...iconProps("sm")} />}
          {...form.register("description")}
        />
      </Field>
      <Controller
        control={form.control}
        name="tags"
        render={({ field }) => (
          <Field label={t("transactions.form.tags")} optional>
            <TagsInput
              value={field.value}
              onChange={field.onChange}
              suggestions={tags.data ?? []}
              placeholder={t("transactions.form.tagsPlaceholder")}
            />
          </Field>
        )}
      />
      <Field
        label={t("transactions.form.note")}
        optional
        error={validationMessage(t, errors.note?.message)}
      >
        <Textarea
          placeholder={t("transactions.form.notePlaceholder")}
          maxLength={255}
          {...form.register("note")}
        />
      </Field>
      <Card flush className="border-0 bg-transparent shadow-none">
        <div className="flex flex-col gap-2">
          <Button type="submit" size="lg" block loading={pending}>
            {submitLabel}
          </Button>
          {secondaryAction}
        </div>
      </Card>
    </form>
  );
}
