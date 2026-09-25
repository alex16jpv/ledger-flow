"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { Field, Textarea } from "@/components/ui/Field";
import { Segment, type SegmentOption } from "@/components/ui/Segment";
import { TagsInput } from "@/components/ui/TagsInput";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { DescriptionInput } from "@/features/transactions/components/DescriptionInput";
import { TransferReadback } from "@/features/transactions/components/TransferReadback";
import { TypeLine } from "@/features/transactions/components/TypeLine";
import {
  FORM_TYPES,
  type FormTransactionType,
  isTooFarAhead,
  toTransactionChanges,
  toTransactionInput,
  transactionFormSchema,
  type TransactionFormValues,
} from "@/features/transactions/form";
import { type ExcludedRow, useTagSuggest } from "@/features/transactions/suggest";
import { INCOME_REFUSED_TYPES, loanOwed, owesMoney } from "@/lib/accounts/debt";
import { fieldErrors, presentError } from "@/lib/api/errors";
import { IdempotencyKeyring } from "@/lib/api/idempotency";
import { dayKey, shiftDayKey } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { useMoney } from "@/lib/i18n/useMoney";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { aheadOfServer, clockStore } from "@/lib/local/clock";
import type { CreateTransactionInput, Transaction, UpdateTransactionInput } from "@/types/api";

import { IntentChips } from "./IntentChips";

const TYPE_TONE = {
  EXPENSE: "default",
  INCOME: "income",
  TRANSFER: "transfer",
} as const;

export interface TransactionFormProps {
  defaultValues: TransactionFormValues;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  // §1 example 3: `changes` is narrowed to the touched fields, so a note never travels as money.
  onSubmit: (
    input: CreateTransactionInput,
    idempotencyKey: string,
    changes: UpdateTransactionInput,
  ) => Promise<unknown>;
  secondaryAction?: React.ReactNode;
  // What the movement belongs to, said before anything is typed.
  notice?: React.ReactNode;
  // Only an expense can be shared in v1, so the control with one answer is not drawn.
  fixedType?: boolean;
  // The row being edited: its own description and tags are taken out of what is suggested.
  editing?: Transaction;
  // A group's expense names an outing, rarely twice the same way: it takes no suggestions (T-193).
  suggest?: boolean;
}

export function TransactionForm({
  defaultValues,
  submitLabel,
  pending,
  error,
  onSubmit,
  secondaryAction,
  notice,
  fixedType = false,
  editing,
  suggest = true,
}: TransactionFormProps) {
  const t = useTranslations();
  const money = useMoney();
  const { timeZone } = useFormatSettings();
  // F-66: the server refuses a date more than 24 h ahead, so the calendar stops there (7.28).
  const tomorrow = shiftDayKey(dayKey(new Date(), timeZone), 1);
  const skew = aheadOfServer(
    useSyncExternalStore(
      clockStore.subscribe,
      clockStore.getSnapshot,
      clockStore.getServerSnapshot,
    ),
  );
  const keyring = useRef(new IdempotencyKeyring());
  const chosenPerType = useRef<Partial<Record<FormTransactionType, string | null>>>({});
  const amountInput = useRef<HTMLInputElement>(null);
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues,
  });
  // `dirtyFields` is read during render: RHF's formState Proxy only tracks what render subscribed.
  const { errors, dirtyFields } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  // The amount is the first thing to type on entering the form and after every type switch (owner request P-22).
  useEffect(() => {
    amountInput.current?.focus();
  }, [type]);
  const transfer = type === "TRANSFER";
  const amount = useWatch({ control: form.control, name: "amount" });
  const fromAccountId = useWatch({ control: form.control, name: "fromAccountId" });
  const toAccountId = useWatch({ control: form.control, name: "toAccountId" });
  const fromOutside = useWatch({ control: form.control, name: "fromOutside" });
  const income = type === "INCOME";
  const accounts = useAccountsQuery(false, transfer || income);
  const [suggestWanted, setSuggestWanted] = useState(false);
  const wantSuggestions = useCallback(() => {
    setSuggestWanted(true);
  }, []);
  const categories = useCategoriesQuery(type, suggestWanted);
  const categoryName = useCallback(
    (id: string) => categories.data?.find((category) => category.id === id)?.name,
    [categories.data],
  );
  const exclude = useMemo<ExcludedRow | undefined>(
    () =>
      editing && {
        type: editing.type,
        description: editing.description,
        tags: editing.tags,
        categoryId: editing.categoryId,
      },
    [editing],
  );
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const chosenTags = useWatch({ control: form.control, name: "tags" });
  const suggestTags = useTagSuggest({
    type: suggest ? type : null,
    categoryId,
    description: () => form.getValues("description"),
    chosen: chosenTags,
    wanted: suggestWanted,
    exclude,
    categoryName,
  });
  const known = accounts.data ?? [];
  const accountOf = (id: string | null) => known.find((account) => account.id === id) ?? null;
  const serverFields = fieldErrors(error);
  const formError = error && Object.keys(serverFields).length === 0 ? presentError(error) : null;
  const typeOptions: SegmentOption<FormTransactionType>[] = FORM_TYPES.map((value) => ({
    value,
    label: t(`transactionTypes.${value}`),
    tone: TYPE_TONE[value],
  }));
  const accountError = validationMessage(
    t,
    errors.accountId?.message ?? serverFields.fromAccountId ?? serverFields.toAccountId,
  );
  const target = transfer ? accountOf(toAccountId) : null;
  const outsideOffered = owesMoney(target);
  const outside = transfer && fromOutside && outsideOffered;
  // A loan cannot be paid more than it owes, and offline the mirror would draw it paid until the sync says no.
  const owedOnTarget = transfer ? loanOwed(target) : null;
  const overLoan =
    owedOnTarget !== null && Number.isFinite(amount) && amount > owedOnTarget
      ? t("accounts.pay.overLoan", { amount: money.format(owedOnTarget) })
      : null;

  async function save(values: TransactionFormValues) {
    if (isTooFarAhead(values, timeZone, new Date())) {
      form.setError("date", { message: "validation.futureDate" });
      return;
    }
    if (overLoan !== null) return;
    if (values.fromOutside && !outsideOffered) {
      form.setError("fromAccountId", { message: "validation.required" });
      return;
    }
    const input = toTransactionInput(
      outside
        ? {
            ...values,
            description: values.description.trim() || t("accounts.pay.outsideDescription"),
          }
        : values,
      timeZone,
    );
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

  function changeType(next: FormTransactionType) {
    // A category belongs to one type, and the server refuses it on another: each type keeps its own.
    chosenPerType.current[type] = form.getValues("categoryId");
    // `shouldDirty` because an edit sends only dirty fields, and this is still the user's change.
    form.setValue("type", next, { shouldDirty: true });
    form.setValue("categoryId", chosenPerType.current[next] ?? null, { shouldDirty: true });
    const chosen = accountOf(form.getValues("accountId"));
    if (next === "INCOME" && chosen !== null && INCOME_REFUSED_TYPES.has(chosen.type)) {
      form.setValue("accountId", null, { shouldDirty: true });
    }
    if (next !== "TRANSFER") form.setValue("fromOutside", false, { shouldDirty: true });
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
      {notice}
      <div className="flex flex-col gap-2">
        {!fixedType && (
          <Segment
            options={typeOptions}
            value={type}
            onChange={changeType}
            label={t("transactions.form.type")}
          />
        )}
        <TypeLine type={type} />
      </div>
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
              invalid={Boolean(errors.amount) || Boolean(serverFields.amount) || overLoan !== null}
              className="py-2"
            />
            {(errors.amount ?? serverFields.amount ?? overLoan) && (
              <span role="alert" className="text-center text-sm text-danger">
                {overLoan ?? validationMessage(t, errors.amount?.message ?? serverFields.amount)}
              </span>
            )}
          </div>
        )}
      />
      {!outside && (
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <CategoryPicker
                type={type}
                value={field.value}
                allowCreate={!transfer}
                label={t(
                  transfer ? "transactions.form.categoryOptional" : "transactions.form.category",
                )}
                onChange={(category) => {
                  field.onChange(category.id);
                }}
              />
              {transfer && (
                <span className="text-sm text-text-3">
                  {t("transactions.form.transferCategoryHelp")}
                </span>
              )}
              {serverFields.categoryId && (
                <span role="alert" className="text-sm text-danger">
                  {validationMessage(t, serverFields.categoryId)}
                </span>
              )}
            </div>
          )}
        />
      )}
      {transfer ? (
        <div className="flex flex-col gap-3">
          <IntentChips
            accounts={known}
            main={known.find((account) => account.isDefault) ?? null}
            from={accountOf(fromAccountId)}
            to={accountOf(toAccountId)}
            onFill={({ from, to }) => {
              form.setValue("fromOutside", false, { shouldDirty: true });
              form.setValue("fromAccountId", from?.id ?? null, { shouldDirty: true });
              form.setValue("toAccountId", to.id, { shouldDirty: true });
              form.clearErrors(["fromAccountId", "toAccountId"]);
            }}
          />
          <div className="flex flex-col gap-2">
            <Controller
              control={form.control}
              name="fromAccountId"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <AccountPicker
                    label={t("transactions.form.from")}
                    value={outside ? null : field.value}
                    exclude={toAccountId}
                    onChange={(account) => {
                      form.setValue("fromOutside", false, { shouldDirty: true });
                      field.onChange(account.id);
                    }}
                    outside={
                      outsideOffered
                        ? {
                            label: t("accounts.pay.outside"),
                            meta: t("accounts.pay.outsideMeta"),
                            selected: outside,
                            onSelect: () => {
                              form.setValue("fromOutside", true, { shouldDirty: true });
                              field.onChange(null);
                              form.clearErrors("fromAccountId");
                            },
                          }
                        : undefined
                    }
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
                disabled={outside}
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
                      if (!owesMoney(account))
                        form.setValue("fromOutside", false, { shouldDirty: true });
                      field.onChange(account.id);
                    }}
                  />
                  {(errors.toAccountId ?? serverFields.toAccountId) && (
                    <span role="alert" className="text-sm text-danger">
                      {validationMessage(
                        t,
                        errors.toAccountId?.message ?? serverFields.toAccountId,
                      )}
                    </span>
                  )}
                </div>
              )}
            />
          </div>
          <TransferReadback
            from={accountOf(fromAccountId)}
            to={target}
            amount={amount}
            outside={outside}
          />
        </div>
      ) : (
        <Controller
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <AccountPicker
                label={t("transactions.form.account")}
                value={field.value}
                omit={income ? INCOME_REFUSED_TYPES : undefined}
                note={income ? t("accounts.picker.incomeNote") : undefined}
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
      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Field
            label={t("transactions.form.description")}
            optional
            error={validationMessage(t, errors.description?.message ?? serverFields.description)}
          >
            <DescriptionInput
              ref={field.ref}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              type={suggest ? type : null}
              exclude={exclude}
              placeholder={t("transactions.form.descriptionPlaceholder")}
            />
          </Field>
        )}
      />
      <Controller
        control={form.control}
        name="tags"
        render={({ field }) => (
          <Field label={t("transactions.form.tags")} optional>
            <TagsInput
              value={field.value}
              onChange={field.onChange}
              suggest={suggestTags}
              onFocus={wantSuggestions}
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
