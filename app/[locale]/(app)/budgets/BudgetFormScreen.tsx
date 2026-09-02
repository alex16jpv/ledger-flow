"use client";

import { CircleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { BudgetForm } from "@/features/budgets/components/BudgetForm";
import {
  type BudgetFormValues,
  defaultBudgetValues,
  fromBudget,
  toCreateInput,
  toUpdateInput,
} from "@/features/budgets/form";
import { useBudgetQuery, useCreateBudget, useUpdateBudget } from "@/features/budgets/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { ApiError } from "@/lib/api/errors";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

const LIST_PATH = "/budgets";

function FormSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={label}>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function NewBudgetScreen() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const { timeZone } = useFormatSettings();
  const [now] = useState(() => new Date());
  const from = params.get("from");
  const source = useBudgetQuery(from ?? "", undefined);
  const categories = useCategoriesQuery(undefined, true, true);
  const create = useCreateBudget();
  const waiting = (from !== null && source.isPending) || categories.isPending;
  const defaults =
    from && source.data
      ? fromBudget(source.data, timeZone, "copy", now)
      : defaultBudgetValues(now, timeZone);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("budgets.form.newTitle")}
        onBack={() => {
          router.back();
        }}
      />
      {waiting ? (
        <FormSkeleton label={t("common.loading")} />
      ) : (
        <BudgetForm
          key={from ?? "new"}
          defaultValues={defaults}
          categories={categories.data ?? []}
          submitLabel={t("budgets.form.create")}
          pending={create.isPending}
          error={create.error}
          onSubmit={async (values: BudgetFormValues) => {
            const budget = await create.mutateAsync(toCreateInput(values, timeZone));
            toast.show({ message: t("budgets.form.created") });
            router.push(`/budgets/${budget.id}`);
          }}
        />
      )}
    </div>
  );
}

export function EditBudgetScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const { timeZone } = useFormatSettings();
  const [now] = useState(() => new Date());
  const budget = useBudgetQuery(id);
  const categories = useCategoriesQuery(undefined, true, true);
  const update = useUpdateBudget(id);
  const notFound = budget.error instanceof ApiError && budget.error.status === 404;
  const row = budget.data;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("budgets.form.editTitle")}
        onBack={() => {
          router.back();
        }}
      />
      {budget.isPending || categories.isPending ? (
        <FormSkeleton label={t("common.loading")} />
      ) : budget.isError || !row ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("budgets.detail.notFound") : t("states.error.title")}
          body={notFound ? undefined : t("states.error.body")}
          action={
            notFound ? (
              <Link href={LIST_PATH} className={buttonClasses({ variant: "secondary" })}>
                {t("common.backToList")}
              </Link>
            ) : (
              <Button
                onClick={() => {
                  void budget.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : row.archivedAt ? (
        <Empty
          icon={<CircleAlert {...iconProps("lg")} />}
          title={t("errors.RESOURCE_ARCHIVED")}
          body={t("budgets.detail.archivedInfo")}
          action={
            <Link href={`/budgets/${id}`} className={buttonClasses({ variant: "secondary" })}>
              {t("common.back")}
            </Link>
          }
        />
      ) : (
        <BudgetForm
          defaultValues={fromBudget(row, timeZone, "edit", now)}
          original={row}
          categories={categories.data ?? []}
          submitLabel={t("common.saveChanges")}
          pending={update.isPending}
          error={update.error}
          onSubmit={async (values) => {
            await update.mutateAsync(toUpdateInput(values, row, timeZone));
            toast.show({ message: t("budgets.form.saved") });
            router.push(`/budgets/${id}`);
          }}
        />
      )}
    </div>
  );
}
