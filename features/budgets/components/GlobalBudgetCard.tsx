"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Projected } from "@/components/ui/Projected";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import type { Budget } from "@/types/api";

import { budgetProgress } from "../progress";
import { useBudgetStatusText } from "./BudgetCard";

export interface GlobalBudgetCardProps {
  budget: Budget;
  now: Date;
  href: string;
}

export function GlobalBudgetCard({ budget, now, href }: GlobalBudgetCardProps) {
  const t = useTranslations("budgets.list");
  const outbox = useOutbox();
  const money = useMoney();
  const statusText = useBudgetStatusText();
  const progress = budgetProgress(budget, now);
  const onTrack = progress.status === "ok" || progress.status === "fast";

  return (
    <Card className="relative flex flex-col gap-3 bg-[linear-gradient(135deg,var(--brand-soft),var(--surface)_70%)]">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={href}
          className="text-xs font-medium tracking-caps text-text-3 uppercase after:absolute after:inset-0"
        >
          {budget.name}
        </Link>
        <Badge tone="brand">
          <Sparkles aria-hidden="true" />
          {t("globalBadge")}
        </Badge>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <Projected when={outbox.projected.budgets}>
          <Amount value={budget.spent} signed={false} size="hero" />
        </Projected>
        <span className="text-sm text-text-3">
          {t("of", { amount: money.format(budget.amount) })}
        </span>
      </div>
      <Projected when={outbox.projected.budgets} align="center" className="w-full">
        <Progress
          value={budget.spent}
          max={budget.amount}
          marker={progress.elapsed}
          color={budget.color}
          label={budget.name}
          className="flex-1"
        />
      </Projected>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className={progress.status === "over" ? "text-danger" : "text-text-2"}>
          {onTrack && progress.daysLeft > 0
            ? t("leftFor", { amount: money.format(progress.remaining), days: progress.daysLeft })
            : statusText(budget, now)}
        </span>
        {progress.perDay !== null && (
          <span className="text-text-3">
            {t("perDay", { amount: money.format(money.round(progress.perDay)) })}
          </span>
        )}
      </div>
    </Card>
  );
}
