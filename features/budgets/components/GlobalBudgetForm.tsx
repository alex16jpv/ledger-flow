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

import { useCreateBudget } from "../hooks";
import { budgetAmountSchema, monthlyBudgetSuggestions } from "../schemas";

interface GlobalBudgetFormProps {
  onDone: () => void;
  submitLabel: string;
  skipLabel: string;
}

export function GlobalBudgetForm({ onDone, submitLabel, skipLabel }: GlobalBudgetFormProps) {
  const t = useTranslations();
  const money = useMoney();
  const createBudget = useCreateBudget();
  const suggestions = monthlyBudgetSuggestions(money.fractionDigits);
  const [amount, setAmount] = useState<number | null>(null);
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
        name: t("budgets.global.defaultName"),
        color: "INDIGO",
        categoryIds: [],
        type: "EXPENSE",
        periodType: "MONTHLY",
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
          label={t("budgets.global.amount")}
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
