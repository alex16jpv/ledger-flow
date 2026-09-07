"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageHeader } from "@/components/shell";
import { DateTimeField, type DateTimeValue } from "@/components/ui/DateTimeField";
import { Segment, type SegmentOption } from "@/components/ui/Segment";
import { AccountPicker } from "@/features/accounts/components/AccountPicker";
import type { CategoryType } from "@/features/categories/api";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import { CATEGORY_TYPES } from "@/features/categories/schemas";
import { dateTimeInstant, dayKey } from "@/lib/format/dates";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import type { Account, Category } from "@/types/api";

const TONE = { EXPENSE: "default", INCOME: "income", TRANSFER: "transfer" } as const;

export function PickersPlayground() {
  const t = useTranslations();
  const { timeZone } = useFormatSettings();
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [category, setCategory] = useState<Category | null>(null);
  const [from, setFrom] = useState<Account | null>(null);
  const [to, setTo] = useState<Account | null>(null);
  const [when, setWhen] = useState<DateTimeValue>(() => ({
    date: dayKey(new Date(), timeZone),
    time: null,
  }));
  const typeOptions: SegmentOption<CategoryType>[] = CATEGORY_TYPES.map((value) => ({
    value,
    label: t(`categoryTypes.${value}`),
    tone: TONE[value],
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dev.pickersPlayground.title")}
        eyebrow={t("dev.pickersPlayground.subtitle")}
      />
      <Segment
        options={typeOptions}
        value={type}
        onChange={(next) => {
          setType(next);
          setCategory(null);
        }}
        label={t("dev.pickersPlayground.type")}
      />
      <div className="flex flex-col gap-2">
        <CategoryPicker type={type} value={category?.id ?? null} onChange={setCategory} />
        <p className="text-sm text-text-3" data-testid="category-result">
          {category
            ? t("dev.pickersPlayground.selected", { value: category.name })
            : t("dev.pickersPlayground.nothing")}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <AccountPicker
          label={t("dev.pickersPlayground.from")}
          value={from?.id ?? null}
          onChange={setFrom}
          exclude={to?.id}
        />
        <AccountPicker
          label={t("dev.pickersPlayground.to")}
          value={to?.id ?? null}
          onChange={setTo}
          exclude={from?.id}
        />
        <p className="text-sm text-text-3" data-testid="account-result">
          {from
            ? t("dev.pickersPlayground.selected", { value: from.name })
            : t("dev.pickersPlayground.nothing")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <DateTimeField
          value={when}
          onChange={setWhen}
          dateLabel={t("common.date")}
          timeLabel={t("common.time")}
        />
        <p className="text-sm text-text-3" data-testid="instant-result">
          {t("dev.pickersPlayground.instant", {
            value: dateTimeInstant(when, timeZone).toISOString(),
          })}
        </p>
      </div>
    </div>
  );
}
