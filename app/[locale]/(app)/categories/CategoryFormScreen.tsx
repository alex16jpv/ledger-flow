"use client";

import { Archive, ArchiveRestore, CircleAlert } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { CategoryType } from "@/features/categories/api";
import { CategoryForm } from "@/features/categories/components/CategoryForm";
import {
  ArchiveCategorySheet,
  RestoreCategoryConflictSheet,
} from "@/features/categories/components/CategorySheets";
import {
  useArchiveCategory,
  useCategoriesQuery,
  useCategoryCounts,
  useCategoryQuery,
  useRestoreCategory,
} from "@/features/categories/hooks";
import { CATEGORY_TYPES } from "@/features/categories/schemas";
import { categoryType, findActiveCategoryByName } from "@/features/categories/summary";
import { ApiError, presentError } from "@/lib/api/errors";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

const LIST_PATH = "/categories";

function parseType(value: string | null): CategoryType {
  return (CATEGORY_TYPES as readonly string[]).includes(value ?? "")
    ? (value as CategoryType)
    : "EXPENSE";
}

export function NewCategoryScreen() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const type = parseType(params.get("type"));
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("categories.form.title")}
        onBack={() => {
          router.back();
        }}
      />
      <CategoryForm
        type={type}
        preview
        onSaved={(category) => {
          toast.show({ message: t("categories.form.created") });
          router.push({ pathname: LIST_PATH, query: { type: categoryType(category) } });
        }}
      />
    </div>
  );
}

export function EditCategoryScreen({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const category = useCategoryQuery(id);
  const categories = useCategoriesQuery(undefined, category.isSuccess, true);
  const usage = useCategoryCounts(category.isSuccess);
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();
  const [sheet, setSheet] = useState<"archive" | "conflict" | null>(null);
  const notFound = category.error instanceof ApiError && category.error.status === 404;
  const row = category.data;

  function fail(error: unknown) {
    toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
  }

  async function confirmArchive() {
    if (!row) return;
    try {
      await archive.mutateAsync(id);
      toast.show({ message: t("categories.archive.done") });
      router.push({ pathname: LIST_PATH, query: { type: categoryType(row) } });
    } catch (error) {
      setSheet(null);
      fail(error);
    }
  }

  async function restoreCategory() {
    try {
      await restore.mutateAsync(id);
      toast.show({ message: t("categories.archive.restored") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "DUPLICATE") {
        await categories.refetch();
        setSheet("conflict");
      } else fail(error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("categories.form.editTitle")}
        onBack={() => {
          router.back();
        }}
        actions={
          row && (
            <Link
              href={{ pathname: "/transactions", query: { category: row.id, period: "all" } }}
              className="text-sm font-medium text-brand-text"
            >
              {t("categories.form.viewTransactions")}
            </Link>
          )
        }
      />
      {category.isPending || (row && !row.archivedAt && usage.isPending) ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : category.isError || !row ? (
        <Empty
          tone={notFound ? "neutral" : "danger"}
          icon={<CircleAlert {...iconProps("lg")} />}
          title={notFound ? t("categories.form.notFound") : t("states.error.title")}
          body={notFound ? undefined : t("states.error.body")}
          action={
            notFound ? (
              <Link href={LIST_PATH} className={buttonClasses({ variant: "secondary" })}>
                {t("common.backToList")}
              </Link>
            ) : (
              <Button
                onClick={() => {
                  void category.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      ) : row.archivedAt ? (
        <>
          <Alert tone="neutral">{t("categories.form.archivedInfo")}</Alert>
          <Button
            size="lg"
            block
            loading={restore.isPending}
            onClick={() => {
              void restoreCategory();
            }}
          >
            <ArchiveRestore {...iconProps("sm")} />
            {t("categories.list.restore")}
          </Button>
          <RestoreCategoryConflictSheet
            category={row}
            conflict={findActiveCategoryByName(categories.data ?? [], row.name)}
            open={sheet === "conflict"}
            onClose={() => {
              setSheet(null);
            }}
          />
        </>
      ) : (
        <>
          <CategoryForm
            category={row}
            lockedCount={usage.counts.get(row.id) ?? 0}
            preview
            onSaved={(saved) => {
              toast.show({ message: t("categories.form.saved") });
              router.push({ pathname: LIST_PATH, query: { type: categoryType(saved) } });
            }}
            secondaryAction={
              <Button
                type="button"
                variant="ghost"
                size="lg"
                block
                onClick={() => {
                  setSheet("archive");
                }}
              >
                <Archive {...iconProps("sm")} />
                {t("categories.archive.action")}
              </Button>
            }
          />
          <ArchiveCategorySheet
            category={row}
            open={sheet === "archive"}
            pending={archive.isPending}
            onConfirm={() => {
              void confirmArchive();
            }}
            onClose={() => {
              setSheet(null);
            }}
          />
        </>
      )}
    </div>
  );
}
