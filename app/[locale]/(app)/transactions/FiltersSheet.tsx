"use client";

import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { CategoryChip, Chip, ChipRow } from "@/components/ui/Chip";
import { Field, Input, Switch } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { CategoryPickerSheet } from "@/features/categories/components/CategoryPickerSheet";
import { useCategoriesQuery, useRecentCategories } from "@/features/categories/hooks";
import {
  DEFAULT_FILTERS,
  PERIOD_PRESETS,
  toListQuery,
  type TransactionFilters,
} from "@/features/transactions/filters";
import { TRANSACTION_TYPES } from "@/features/transactions/form";
import { useTransactionsCount } from "@/features/transactions/hooks";
import { dayKey } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";

interface FiltersSheetProps {
  open: boolean;
  filters: TransactionFilters;
  onClose: () => void;
  onApply: (filters: TransactionFilters) => void;
}

export function FiltersSheet({ open, filters, onClose, onApply }: FiltersSheetProps) {
  const t = useTranslations("transactions");
  const tc = useTranslations("common");
  const { timeZone } = useFormatSettings();
  const [draft, setDraft] = useState<TransactionFilters>(filters);
  const [pickerOpen, setPickerOpen] = useState(false);
  const accounts = useAccountsQuery();
  const categoryType = draft.type === "INCOME" ? "INCOME" : "EXPENSE";
  const categories = useCategoriesQuery(categoryType);
  const recent = useRecentCategories(categoryType, categories.data, 4);
  const count = useTransactionsCount(toListQuery(draft, timeZone), open);
  const selectedCategory = categories.data?.find((category) => category.id === draft.categoryId);
  const categoryChips =
    selectedCategory && !recent.some((category) => category.id === selectedCategory.id)
      ? [selectedCategory, ...recent]
      : recent;

  function patch(next: Partial<TransactionFilters>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function choosePeriod(period: TransactionFilters["period"]) {
    if (period === "custom" && (!draft.from || !draft.to)) {
      const today = dayKey(new Date(), timeZone);
      patch({ period, from: today.slice(0, 8) + "01", to: today });
      return;
    }
    patch({ period });
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t("filters.title")}
        footer={
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="lg"
              className="flex-1"
              onClick={() => {
                setDraft({ ...DEFAULT_FILTERS, q: filters.q });
              }}
            >
              {t("filters.clear")}
            </Button>
            <Button
              size="lg"
              className="flex-[1.4]"
              onClick={() => {
                onApply(draft);
              }}
            >
              {count.data === undefined
                ? t("filters.showCounting")
                : t("filters.show", { count: count.data })}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("filters.period")}>
            <ChipRow role="group" aria-label={t("filters.period")}>
              {PERIOD_PRESETS.map((preset) => (
                <Chip
                  key={preset}
                  selected={draft.period === preset}
                  onClick={() => {
                    choosePeriod(preset);
                  }}
                >
                  {t(`list.periods.${preset}`)}
                </Chip>
              ))}
            </ChipRow>
          </Field>
          {draft.period === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("filters.from")}>
                <Input
                  type="date"
                  value={draft.from ?? ""}
                  onChange={(event) => {
                    if (event.target.value) patch({ from: event.target.value });
                  }}
                />
              </Field>
              <Field label={t("filters.to")}>
                <Input
                  type="date"
                  value={draft.to ?? ""}
                  min={draft.from ?? undefined}
                  onChange={(event) => {
                    if (event.target.value) patch({ to: event.target.value });
                  }}
                />
              </Field>
            </div>
          )}
          <Field label={t("filters.type")}>
            <ChipRow role="group" aria-label={t("filters.type")}>
              <Chip
                selected={draft.type === null}
                onClick={() => {
                  patch({ type: null });
                }}
              >
                {t("list.types.ALL")}
              </Chip>
              {TRANSACTION_TYPES.map((type) => (
                <Chip
                  key={type}
                  selected={draft.type === type}
                  onClick={() => {
                    patch({
                      type,
                      categoryId:
                        type === "TRANSFER" || type === "ADJUSTMENT" ? null : draft.categoryId,
                    });
                  }}
                >
                  {t(`list.types.${type}`)}
                </Chip>
              ))}
            </ChipRow>
          </Field>
          <Field label={t("filters.account")}>
            <ChipRow role="group" aria-label={t("filters.account")}>
              {(accounts.data ?? []).map((account) => {
                const Icon = accountTypeIcon(account.type);
                return (
                  <CategoryChip
                    key={account.id}
                    color={account.color}
                    selected={draft.accountId === account.id}
                    icon={<Icon {...iconProps("sm")} />}
                    onClick={() => {
                      patch({ accountId: draft.accountId === account.id ? null : account.id });
                    }}
                  >
                    {account.name}
                  </CategoryChip>
                );
              })}
            </ChipRow>
          </Field>
          <Field label={t("filters.category")}>
            <ChipRow role="group" aria-label={t("filters.category")}>
              {categoryChips.map((category) => (
                <CategoryChip
                  key={category.id}
                  color={category.color}
                  selected={draft.categoryId === category.id}
                  icon={<CategoryIcon icon={category.icon} size="sm" />}
                  onClick={() => {
                    patch({
                      categoryId: draft.categoryId === category.id ? null : category.id,
                      uncategorized: false,
                    });
                  }}
                >
                  {category.name}
                </CategoryChip>
              ))}
              <Chip
                aria-haspopup="dialog"
                onClick={() => {
                  setPickerOpen(true);
                }}
              >
                {tc("more")}
              </Chip>
              <Chip
                selected={draft.uncategorized}
                onClick={() => {
                  patch({ uncategorized: !draft.uncategorized, categoryId: null });
                }}
              >
                {t("list.uncategorized")}
              </Chip>
            </ChipRow>
          </Field>
          <Field label={t("filters.tag")}>
            <Input
              value={draft.tag ?? ""}
              placeholder={t("filters.tagPlaceholder")}
              autoComplete="off"
              autoCapitalize="none"
              leading={<Tag {...iconProps("sm")} />}
              onChange={(event) => {
                const tag = event.target.value.trim().toLowerCase().replace(/^#+/, "");
                patch({ tag: tag || null });
              }}
            />
          </Field>
          <label className="flex items-center gap-3 text-sm text-text-2">
            <Switch
              checked={draft.pendingDetails}
              onCheckedChange={(checked) => {
                patch({ pendingDetails: checked });
              }}
              label={t("filters.pendingOnly")}
            />
            <span aria-hidden="true">{t("filters.pendingOnly")}</span>
          </label>
          <label className="flex items-center gap-3 text-sm text-text-2">
            <Switch
              checked={draft.quickOnly}
              onCheckedChange={(checked) => {
                patch({ quickOnly: checked });
              }}
              label={t("filters.quickOnly")}
            />
            <span aria-hidden="true">{t("filters.quickOnly")}</span>
          </label>
        </div>
      </Sheet>
      <CategoryPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
        type={categoryType}
        value={draft.categoryId}
        onSelect={(category) => {
          patch({ categoryId: category.id, uncategorized: false });
        }}
        allowCreate={false}
      />
    </>
  );
}
