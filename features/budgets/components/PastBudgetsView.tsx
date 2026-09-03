"use client";

import { Archive, ArchiveRestore, ChartPie, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { Segment } from "@/components/ui/Segment";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError, presentError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import type { Budget, Category } from "@/types/api";

import { useBudgetsQuery, useRestoreBudget } from "../hooks";
import { findOverlapping } from "../progress";
import { BudgetCard } from "./BudgetCard";
import { RestoreBudgetConflictSheet } from "./BudgetSheets";
import { budgetIcon } from "./BudgetsView";

export type PastTab = "ended" | "archived";

export interface PastBudgetsViewProps {
  tab: PastTab;
  categories: ReadonlyMap<string, Category>;
  onTabChange: (tab: PastTab) => void;
  onBack: () => void;
  now?: Date;
}

export function PastBudgetsView({
  tab,
  categories,
  onTabChange,
  onBack,
  now = new Date(),
}: PastBudgetsViewProps) {
  const t = useTranslations("budgets.past");
  const tc = useTranslations();
  const toast = useToast();
  const budgets = useBudgetsQuery({ includeExpired: true, includeArchived: true });
  const restore = useRestoreBudget();
  const [conflict, setConflict] = useState<Budget | null>(null);
  const all = budgets.data ?? [];

  async function restoreOne(budget: Budget) {
    try {
      await restore.mutateAsync({ id: budget.id });
      toast.show({ message: tc("budgets.detail.restored") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "BUDGET_PERIOD_OVERLAP") setConflict(budget);
      else toast.show({ message: tc(presentError(error).messageKey), tone: "danger" });
    }
  }
  const archived = all.filter((budget) => budget.archivedAt);
  const ended = all.filter((budget) => !budget.archivedAt && budget.expired);
  const visible = tab === "ended" ? ended : archived;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
      <PageHeader title={t("title")} onBack={onBack} />
      <Segment<PastTab>
        label={t("title")}
        value={tab}
        onChange={onTabChange}
        options={[
          { value: "ended", label: t("ended", { count: ended.length }) },
          { value: "archived", label: t("archived", { count: archived.length }) },
        ]}
      />
      {budgets.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={tc("common.loading")}>
          <Card className="flex flex-col gap-3">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-1.5 w-full" />
          </Card>
        </div>
      ) : budgets.isError ? (
        <Empty
          tone="danger"
          icon={<ChartPie {...iconProps("lg")} />}
          title={tc("states.error.title")}
          body={<LoadErrorBody error={budgets.error} />}
          action={
            <Button
              onClick={() => {
                void budgets.refetch();
              }}
            >
              {tc("common.retry")}
            </Button>
          }
        />
      ) : visible.length === 0 ? (
        <Empty
          icon={<Archive {...iconProps("lg")} />}
          title={tab === "ended" ? t("emptyEnded") : t("emptyArchived")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((budget) => (
            <div key={budget.id} className="relative">
              <BudgetCard
                budget={budget}
                icon={budgetIcon(budget, categories)}
                now={now}
                href={`/budgets/${budget.id}`}
                statusBadge={
                  <Badge tone="outline">
                    {tab === "ended" ? t("endedBadge") : t("archivedBadge")}
                  </Badge>
                }
                footer={
                  <span className="relative z-10 flex justify-end gap-2">
                    {tab === "archived" && (
                      <Button
                        size="sm"
                        aria-label={`${t("restore")} ${budget.name}`}
                        loading={restore.isPending && restore.variables.id === budget.id}
                        onClick={() => {
                          void restoreOne(budget);
                        }}
                      >
                        <ArchiveRestore {...iconProps("sm")} />
                        {t("restore")}
                      </Button>
                    )}
                    <Link
                      href={`/budgets/new?from=${budget.id}`}
                      className={buttonClasses({ variant: "secondary", size: "sm" })}
                    >
                      <Copy {...iconProps("sm")} />
                      {t("createAgain")}
                    </Link>
                  </span>
                }
              />
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-xs text-text-3">{t("note")}</p>
      {conflict && (
        <RestoreBudgetConflictSheet
          budget={conflict}
          conflict={findOverlapping(conflict, all)}
          open
          onClose={() => {
            setConflict(null);
          }}
        />
      )}
    </div>
  );
}
