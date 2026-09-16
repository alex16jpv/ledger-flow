"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { AmountInput } from "@/components/ui/AmountInput";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { presentError } from "@/lib/api/errors";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { randomColorToken } from "@/lib/theme/feature-color";

import { budgetSuggestions } from "../form";
import { useCreateBudget } from "../hooks";
import { useLastMonthSpending } from "../hooks";
import type { RecurringBudgetPeriod } from "../progress";
import { budgetAmountSchema } from "../schemas";

interface GlobalBudgetFormProps {
  onDone: () => void;
  submitLabel: string;
  skipLabel: string;
  periodType?: RecurringBudgetPeriod;
}

export function GlobalBudgetForm({
  onDone,
  submitLabel,
  skipLabel,
  periodType = "MONTHLY",
}: GlobalBudgetFormProps) {
  const t = useTranslations();
  const money = useMoney();
  const createBudget = useCreateBudget();
  const lastMonth = useLastMonthSpending();
  const suggestions = budgetSuggestions(
    money.currency,
    money.fractionDigits,
    lastMonth.data ?? null,
    periodType,
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [suggestedColor] = useState(() => randomColorToken());
  const [inputKey, setInputKey] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  const failure = createBudget.error ? presentError(createBudget.error) : null;

  async function create() {
    const parsed = budgetAmountSchema.safeParse({ amount });
    if (!parsed.success) {
      setValidation(t("validation.amountPositive"));
      return;
    }
    setValidation(null);
    try {
      await createBudget.mutateAsync({
        name: t(`budgets.global.nameByPeriod.${periodType}`),
        color: suggestedColor,
        categoryIds: [],
        type: "EXPENSE",
        periodType,
        amount: parsed.data.amount,
      });
      onDone();
    } catch {
      return;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {failure && <Alert tone="danger">{t(failure.messageKey)}</Alert>}
      <Card className="flex flex-col gap-3 bg-[linear-gradient(135deg,var(--brand-soft),var(--surface)_70%)]">
        <AmountInput
          key={inputKey}
          label={t(`budgets.global.amountByPeriod.${periodType}`)}
          defaultValue={amount}
          onChange={setAmount}
          invalid={validation !== null}
          autoFocus
          className="py-3"
        />
        {validation && (
          <span role="alert" className="text-center text-sm text-danger">
            {validation}
          </span>
        )}
        {lastMonth.data ? (
          <span className="text-center text-xs text-text-3">
            {t(
              periodType === "MONTHLY"
                ? "budgets.form.suggestionsFromSpending"
                : "budgets.form.suggestionsScaled",
            )}
          </span>
        ) : null}
        <ChipRow className="justify-center">
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              selected={amount === suggestion}
              onClick={() => {
                setAmount(suggestion);
                setInputKey((key) => key + 1);
              }}
            >
              {money.format(suggestion)}
            </Chip>
          ))}
        </ChipRow>
      </Card>
      <Alert tone="neutral">
        <Sparkles {...iconProps("sm")} className="sr-only" />
        {t("budgets.global.help")}
      </Alert>
      <Button
        size="lg"
        block
        loading={createBudget.isPending}
        onClick={() => {
          void create();
        }}
      >
        {submitLabel}
      </Button>
      <Button variant="ghost" block onClick={onDone}>
        {skipLabel}
      </Button>
    </div>
  );
}
