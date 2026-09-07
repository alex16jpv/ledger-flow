"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Budget } from "@/types/api";

export interface OverrideSheetProps {
  budget: Budget;
  periodLabel: string;
  open: boolean;
  pending: boolean;
  error?: string;
  onConfirm: (amount: number) => void;
  onClose: () => void;
}

export function OverrideSheet({
  budget,
  periodLabel,
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: OverrideSheetProps) {
  const t = useTranslations("budgets.detail");
  const tc = useTranslations("common");
  const money = useMoney();
  const [amount, setAmount] = useState<number | null>(budget.amount);
  const valid = amount !== null && amount >= 0 && amount !== budget.amount;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("overrideTitle")}
      footer={
        <>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button
            size="lg"
            block
            disabled={!valid}
            loading={pending}
            onClick={() => {
              if (amount !== null) onConfirm(amount);
            }}
          >
            {t("overrideSave")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {tc("cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-text-2">
          {t("overrideLabel", { period: periodLabel })}
        </span>
        <Card className="p-0">
          <AmountInput
            label={t("overrideLabel", { period: periodLabel })}
            defaultValue={budget.amount}
            onChange={setAmount}
            autoFocus
            className="py-4"
          />
        </Card>
        <Alert tone="neutral">
          {t("overrideHelp", { period: periodLabel, amount: money.format(budget.baseAmount) })}
        </Alert>
      </div>
    </Sheet>
  );
}

export function ArchiveBudgetSheet({
  budget,
  open,
  pending,
  onConfirm,
  onClose,
}: {
  budget: Budget;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("budgets.detail");
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("archiveTitle", { name: budget.name })}
      footer={
        <>
          <Button variant="dangerSolid" size="lg" block loading={pending} onClick={onConfirm}>
            {t("archive")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {tc("cancel")}
          </Button>
        </>
      }
    >
      <Alert tone="danger">{t("archiveBody")}</Alert>
    </Sheet>
  );
}

export function RestoreBudgetConflictSheet({
  budget,
  conflict,
  open,
  onClose,
}: {
  budget: Budget;
  conflict: Budget | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const period = t(`periodTypes.${budget.periodType}`).toLocaleLowerCase();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("restoreConflict.title")}
      footer={
        <>
          <Link
            href={`/budgets/new?from=${budget.id}`}
            className={buttonClasses({ size: "lg", block: true })}
          >
            {t("past.createAgain")}
          </Link>
          {conflict && (
            <Link
              href={`/budgets/${conflict.id}`}
              className={buttonClasses({ variant: "secondary", size: "lg", block: true })}
            >
              {t("restoreConflict.open", { name: conflict.name })}
            </Link>
          )}
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {tc("close")}
          </Button>
        </>
      }
    >
      <Alert tone="danger">
        {conflict
          ? t("restoreConflict.body", { name: conflict.name, period })
          : t("restoreConflict.bodyUnknown", { period })}
      </Alert>
    </Sheet>
  );
}
