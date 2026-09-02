"use client";

import { Hash, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CategoryChip, Chip, ChipRow } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Input } from "@/components/ui/Field";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { CategoryPickerSheet } from "@/features/categories/components/CategoryPickerSheet";
import type { TransactionLookups } from "@/features/transactions/components/TransactionRow";
import { useUpdateTransaction } from "@/features/transactions/hooks";
import { presentError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Category, Transaction } from "@/types/api";

interface ReviewCardProps {
  transaction: Transaction;
  lookups: TransactionLookups;
  recent: readonly Category[];
  focused: boolean;
}

export function ReviewCard({ transaction, lookups, recent, focused }: ReviewCardProps) {
  const t = useTranslations();
  const tc = useTranslations("common");
  const dates = useDates();
  const toast = useToast();
  const update = useUpdateTransaction(transaction.id);
  const [categoryId, setCategoryId] = useState<string | null>(transaction.categoryId);
  const [description, setDescription] = useState(transaction.description ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focused) card.current?.scrollIntoView({ block: "center" });
  }, [focused]);

  const account = lookups.accounts.get(transaction.fromAccountId ?? "");
  const selected = lookups.categories.get(categoryId ?? "");
  const chips =
    selected && !recent.some((category) => category.id === selected.id)
      ? [selected, ...recent]
      : recent;
  const when = new Date(transaction.date);
  const now = new Date();
  const day = dates.dayKey(when);
  const dayLabel =
    day === dates.dayKey(now)
      ? tc("today")
      : day === dates.dayKey(new Date(now.getTime() - 86_400_000))
        ? tc("yesterday")
        : dates.formatDay(when);

  async function done() {
    try {
      await update.mutateAsync({
        categoryId,
        description: description.trim() || null,
        pendingDetails: false,
      });
      toast.show({ message: t("transactions.review.saved") });
    } catch (error) {
      toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
    }
  }

  return (
    <Card
      ref={card}
      className={cn(
        "flex flex-col gap-3",
        focused && "border-brand shadow-[0_0_0_3px_var(--focus-ring)]",
      )}
      data-transaction-id={transaction.id}
    >
      <div className="flex items-center gap-3">
        <Tile className="bg-surface-2 text-text-2">
          <Hash {...iconProps("md")} />
        </Tile>
        <span className="flex min-w-0 flex-1 flex-col">
          <Amount value={transaction.amount} kind="expense" size="lg" />
          <span className="text-sm text-text-3">
            {t("transactions.review.when", {
              day: dayLabel,
              time: dates.formatTime(when),
              account: account?.name ?? t("transactions.detail.unknownAccount"),
            })}
          </span>
        </span>
        <Badge tone="warning">{t("transactions.list.toReview")}</Badge>
      </div>
      <ChipRow role="group" aria-label={t("transactions.form.category")}>
        {chips.map((category) => (
          <CategoryChip
            key={category.id}
            color={category.color}
            selected={category.id === categoryId}
            icon={<CategoryIcon icon={category.icon} size="sm" />}
            onClick={() => {
              setCategoryId(category.id === categoryId ? null : category.id);
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
          {t("transactions.review.other")}
        </Chip>
      </ChipRow>
      <Input
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
        }}
        placeholder={t("transactions.review.descriptionPlaceholder")}
        aria-label={t("transactions.form.description")}
        autoComplete="off"
        maxLength={255}
        leading={<PencilLine {...iconProps("sm")} />}
        className="h-10"
      />
      <div className="flex items-center justify-end gap-2">
        <Link
          href={`/transactions/${transaction.id}/edit`}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          {t("transactions.review.openFull")}
        </Link>
        <Button
          size="sm"
          loading={update.isPending}
          onClick={() => {
            void done();
          }}
        >
          {t("transactions.review.done")}
        </Button>
      </div>
      <CategoryPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
        }}
        type="EXPENSE"
        value={categoryId}
        onSelect={(category) => {
          setCategoryId(category.id);
        }}
      />
    </Card>
  );
}
