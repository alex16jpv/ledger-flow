"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CategoryChip, Chip, ChipRow } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Field, FieldGroup, Input, Textarea } from "@/components/ui/Field";
import { Segment } from "@/components/ui/Segment";
import { SwatchGrid } from "@/components/ui/Swatch";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { validationMessage } from "@/lib/i18n/validation";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Budget, Category } from "@/types/api";

import {
  BUDGET_NOTE_MAX,
  budgetFormSchema,
  type BudgetFormValues,
  type BudgetScope,
} from "../form";
import { BUDGET_PERIOD_TYPES } from "../progress";

const SEARCH_THRESHOLD = 8;

export interface BudgetFormProps {
  defaultValues: BudgetFormValues;
  original?: Budget;
  categories: readonly Category[];
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (values: BudgetFormValues) => Promise<unknown>;
  secondaryAction?: ReactNode;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function BudgetForm({
  defaultValues,
  original,
  categories,
  submitLabel,
  pending,
  error,
  onSubmit,
  secondaryAction,
}: BudgetFormProps) {
  const t = useTranslations();
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues,
  });
  const { errors } = form.formState;
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(defaultValues.note || defaultValues.effectiveFrom),
  );
  const [search, setSearch] = useState("");
  const [scope, periodType, periodStartDate, periodEndDate] = useWatch({
    control: form.control,
    name: ["scope", "periodType", "periodStartDate", "periodEndDate"],
  });
  const serverFields = fieldErrors(error);
  const code = error instanceof ApiError ? error.code : null;
  const categoryError =
    code === "CATEGORY_ARCHIVED" || code === "CATEGORY_TYPE_MISMATCH"
      ? t(presentError(error).messageKey)
      : undefined;
  const overlap = code === "BUDGET_PERIOD_OVERLAP";
  const formError =
    error && !overlap && !categoryError && Object.keys(serverFields).length === 0
      ? presentError(error)
      : null;
  const periodLabel = t(`budgets.periodTypes.${periodType}`).toLocaleLowerCase();
  const periodChanged =
    original !== undefined &&
    (periodType !== original.periodType ||
      (periodType === "CUSTOM" &&
        (periodStartDate !== defaultValues.periodStartDate ||
          periodEndDate !== defaultValues.periodEndDate)));

  const selectable = useMemo(() => {
    const kept = new Set(defaultValues.categoryIds);
    return categories
      .filter(
        (category) =>
          (category.type ?? "EXPENSE") === "EXPENSE" &&
          (!category.archivedAt || kept.has(category.id)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, defaultValues.categoryIds]);
  const needle = normalize(search.trim());
  const visible = selectable.filter(
    (category) => needle.length === 0 || normalize(category.name).includes(needle),
  );

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
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
      <div className="flex flex-col gap-4">
        <Field
          label={t("budgets.form.name")}
          error={validationMessage(t, errors.name?.message ?? serverFields.name)}
        >
          <Input
            placeholder={t("budgets.form.namePlaceholder")}
            autoComplete="off"
            autoFocus={!original}
            {...form.register("name")}
          />
        </Field>
        <Controller
          control={form.control}
          name="scope"
          render={({ field }) => (
            <Field label={t("budgets.form.scope")} help={t("budgets.form.scopeHelp")}>
              <Segment<BudgetScope>
                label={t("budgets.form.scope")}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "global", label: t("budgets.form.global") },
                  { value: "categories", label: t("budgets.form.byCategory") },
                ]}
              />
            </Field>
          )}
        />
        {scope === "categories" && (
          <Controller
            control={form.control}
            name="categoryIds"
            render={({ field }) => (
              <Field
                label={t("budgets.form.category")}
                help={t("budgets.form.categoriesHelp")}
                error={categoryError ?? validationMessage(t, errors.categoryIds?.message)}
              >
                <div className="flex flex-col gap-2">
                  {selectable.length > SEARCH_THRESHOLD && (
                    <Input
                      type="search"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                      }}
                      placeholder={t("budgets.form.categoriesSearch")}
                      aria-label={t("budgets.form.categoriesSearch")}
                      leading={<Search {...iconProps("sm")} />}
                      autoComplete="off"
                      className="h-10"
                    />
                  )}
                  {selectable.length === 0 ? (
                    <p className="text-sm text-text-3">{t("budgets.form.noCategories")}</p>
                  ) : (
                    <ChipRow
                      role="group"
                      aria-label={t("budgets.form.category")}
                      className="flex-wrap overflow-visible"
                    >
                      {visible.map((category) => {
                        const selected = field.value.includes(category.id);
                        return (
                          <CategoryChip
                            key={category.id}
                            color={category.color}
                            selected={selected}
                            icon={<CategoryIcon icon={category.icon} size="sm" />}
                            className={cn(category.archivedAt && "opacity-70")}
                            onClick={() => {
                              field.onChange(selected ? [] : [category.id]);
                            }}
                          >
                            {category.name}
                            {category.archivedAt && (
                              <Badge tone="warning">{t("budgets.detail.archivedChip")}</Badge>
                            )}
                          </CategoryChip>
                        );
                      })}
                    </ChipRow>
                  )}
                </div>
              </Field>
            )}
          />
        )}
        <Controller
          control={form.control}
          name="periodType"
          render={({ field }) => (
            <Field
              label={t("budgets.form.period")}
              error={validationMessage(t, errors.periodType?.message)}
            >
              <ChipRow
                role="group"
                aria-label={t("budgets.form.period")}
                className="flex-wrap overflow-visible"
              >
                {BUDGET_PERIOD_TYPES.map((option) => (
                  <Chip
                    key={option}
                    selected={field.value === option}
                    onClick={() => {
                      field.onChange(option);
                    }}
                  >
                    {t(`budgets.periodTypes.${option}`)}
                  </Chip>
                ))}
              </ChipRow>
            </Field>
          )}
        />
        {periodType === "CUSTOM" && (
          <FieldGroup>
            <Field
              label={t("budgets.form.startDate")}
              error={validationMessage(t, errors.periodStartDate?.message)}
            >
              <Input type="date" {...form.register("periodStartDate")} />
            </Field>
            <Field
              label={t("budgets.form.endDate")}
              error={validationMessage(t, errors.periodEndDate?.message)}
            >
              <Input type="date" min={periodStartDate} {...form.register("periodEndDate")} />
            </Field>
          </FieldGroup>
        )}
        {periodChanged && <Alert tone="warning">{t("budgets.form.periodChangeWarning")}</Alert>}
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <Field
              label={t("budgets.form.amount")}
              error={validationMessage(t, errors.amount?.message ?? serverFields.amount)}
            >
              <Card className="p-0">
                <AmountInput
                  label={t("budgets.form.amount")}
                  defaultValue={Number.isFinite(field.value) ? field.value : null}
                  onChange={(value) => {
                    field.onChange(value ?? Number.NaN);
                  }}
                  invalid={Boolean(errors.amount)}
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
              label={t("budgets.form.color")}
              error={validationMessage(t, errors.color?.message)}
            >
              <SwatchGrid
                value={field.value}
                onChange={field.onChange}
                label={t("budgets.form.color")}
              />
            </Field>
          )}
        />
        <Card flush>
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => {
              setAdvancedOpen((open) => !open);
            }}
            className="flex min-h-12 w-full items-center gap-3 px-4 text-left font-medium hover:bg-surface-2"
          >
            <span className="flex-1">{t("budgets.form.advanced")}</span>
            <ChevronDown
              {...iconProps("md")}
              className={cn(
                "text-text-3 transition-transform duration-(--dur-1) ease-(--ease)",
                advancedOpen && "rotate-180",
              )}
            />
          </button>
          <div hidden={!advancedOpen} className="flex flex-col gap-4 border-t border-border p-4">
            <Field
              label={t("budgets.form.effectiveFrom")}
              help={t("budgets.form.effectiveFromHelp")}
              error={validationMessage(t, errors.effectiveFrom?.message)}
            >
              <Input type="date" {...form.register("effectiveFrom")} />
            </Field>
            <Field
              label={t("budgets.form.note")}
              optional
              error={validationMessage(t, errors.note?.message)}
            >
              <Textarea
                placeholder={t("budgets.form.notePlaceholder")}
                maxLength={BUDGET_NOTE_MAX}
                {...form.register("note")}
              />
            </Field>
          </div>
        </Card>
      </div>
      <div className="flex flex-col gap-2">
        {overlap && (
          <Alert tone="danger">
            {scope === "global"
              ? t("budgets.form.overlapGlobal", { period: periodLabel })
              : t("budgets.form.overlap", { period: periodLabel })}
          </Alert>
        )}
        {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
        <Button type="submit" size="lg" block loading={pending}>
          {submitLabel}
        </Button>
        {secondaryAction}
      </div>
    </form>
  );
}
