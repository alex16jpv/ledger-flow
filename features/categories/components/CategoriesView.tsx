"use client";

import { ChevronDown, Plus, RotateCcw, Tags } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { List, Row, RowBody, RowMeta, RowTitle } from "@/components/ui/Row";
import { Segment } from "@/components/ui/Segment";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { ApiError, presentError } from "@/lib/api/errors";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { connectivityStore } from "@/lib/network/connectivity";
import type { Category } from "@/types/api";

import type { CategoryType } from "../api";
import {
  useCategoriesQuery,
  useCategoryCounts,
  useRestoreCategory,
  useRestoreDefaultCategories,
} from "../hooks";
import { CATEGORY_TYPES } from "../schemas";
import { categoryType, findActiveCategoryByName } from "../summary";
import { RestoreCategoryConflictSheet } from "./CategorySheets";

const SEGMENT_TONE = { EXPENSE: "default", INCOME: "income", TRANSFER: "transfer" } as const;
const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6";
const TILE =
  "flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none";

function parseType(value: string | null): CategoryType {
  return (CATEGORY_TYPES as readonly string[]).includes(value ?? "")
    ? (value as CategoryType)
    : "EXPENSE";
}

export function CategoriesView() {
  const t = useTranslations();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const type = parseType(params.get("type"));
  const categories = useCategoriesQuery(undefined, true, true);
  const usage = useCategoryCounts(categories.isSuccess);
  const restore = useRestoreCategory();
  const restoreDefaults = useRestoreDefaultCategories();
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [conflict, setConflict] = useState<Category | null>(null);
  const archivedId = useId();
  // F-20: the server mints these ids, so there is nothing the queue could project. It is the one
  // action on this screen that needs the network, and it says so instead of failing.
  const offline =
    useSyncExternalStore(
      connectivityStore.subscribe,
      connectivityStore.getSnapshot,
      connectivityStore.getServerSnapshot,
    ) === "offline";

  const active = useMemo(
    () => (categories.data ?? []).filter((category) => !category.archivedAt),
    [categories.data],
  );
  const archived = useMemo(
    () => (categories.data ?? []).filter((category) => Boolean(category.archivedAt)),
    [categories.data],
  );
  const visible = active.filter((category) => categoryType(category) === type);
  const countOf = (option: CategoryType) =>
    active.filter((category) => categoryType(category) === option).length;

  function fail(error: unknown) {
    toast.show({ message: t(presentError(error).messageKey), tone: "danger" });
  }

  async function restoreOne(category: Category, name?: string) {
    try {
      await restore.mutateAsync({ id: category.id, name });
      setConflict(null);
      toast.show({ message: t("categories.archive.restored") });
    } catch (error) {
      if (error instanceof ApiError && error.code === "DUPLICATE") {
        await categories.refetch();
        setConflict(category);
      } else fail(error);
    }
  }
  const conflictError =
    conflict &&
    restore.error instanceof ApiError &&
    restore.error.code === "DUPLICATE" &&
    restore.variables?.name
      ? t("categories.form.duplicate", { name: restore.variables.name })
      : undefined;

  async function recreateDefaults() {
    try {
      const result = await restoreDefaults.mutateAsync();
      toast.show({
        message:
          result.data.length === 0
            ? t("categories.list.restoreDefaults.none")
            : t("categories.list.restoreDefaults.created", { count: result.data.length }),
      });
    } catch (error) {
      fail(error);
    }
  }

  const newHref = { pathname: "/categories/new", query: { type } } as const;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("categories.list.title")}
        actions={
          <>
            <span className="md:hidden">
              <Link
                href={newHref}
                aria-label={t("categories.list.new")}
                className={buttonClasses({ variant: "secondary", iconOnly: true, round: true })}
              >
                <Plus {...iconProps("md")} />
              </Link>
            </span>
            <span className="hidden md:inline-flex">
              <Link href={newHref} className={buttonClasses({})}>
                <Plus {...iconProps("sm")} />
                {t("categories.list.new")}
              </Link>
            </span>
          </>
        }
      />
      <Segment<CategoryType>
        label={t("categories.form.type")}
        value={type}
        onChange={(next) => {
          router.replace({ pathname: "/categories", query: { type: next } });
        }}
        options={CATEGORY_TYPES.map((option) => ({
          value: option,
          tone: SEGMENT_TONE[option],
          label: categories.data
            ? t("categories.list.typeCount", {
                label: t(`categoryTypes.${option}`),
                count: countOf(option),
              })
            : t(`categoryTypes.${option}`),
        }))}
      />
      {categories.isPending ? (
        <div className={GRID} aria-busy="true" aria-label={t("common.loading")}>
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="flex min-h-[132px] flex-col items-center gap-2">
              <Skeleton className="size-14 rounded-[16px]" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-2/5" />
            </Card>
          ))}
        </div>
      ) : categories.isError ? (
        <Empty
          tone="danger"
          icon={<Tags {...iconProps("lg")} />}
          title={t("states.error.title")}
          body={<LoadErrorBody error={categories.error} />}
          action={
            <Button
              onClick={() => {
                void categories.refetch();
              }}
            >
              {t("common.retry")}
            </Button>
          }
        />
      ) : (
        <>
          {visible.length === 0 && (
            <Empty
              icon={<Tags {...iconProps("lg")} />}
              title={t("categories.list.empty.title")}
              body={t("categories.list.empty.body")}
            />
          )}
          <div className={GRID}>
            {visible.map((category) => {
              const count = usage.counts.get(category.id) ?? 0;
              return (
                <Link
                  key={category.id}
                  href={`/categories/${category.id}/edit`}
                  className={cn(
                    TILE,
                    "border-border bg-surface shadow-1 transition-[border-color] duration-(--dur-1) ease-(--ease) hover:border-border-strong",
                  )}
                >
                  <Tile size="lg" color={category.color}>
                    <CategoryIcon icon={category.icon} size="lg" />
                  </Tile>
                  <span className="w-full truncate text-sm font-medium">{category.name}</span>
                  <span className="text-xs text-text-3">
                    {usage.isPending
                      ? "…"
                      : count === 0
                        ? t("categories.list.unused")
                        : t("categories.list.txns", { count })}
                  </span>
                </Link>
              );
            })}
            <Link
              href={newHref}
              className={cn(
                TILE,
                "border-[1.5px] border-dashed border-border-strong text-brand-text hover:bg-surface-2",
              )}
            >
              <Tile size="lg" variant="outline">
                <Plus {...iconProps("lg")} />
              </Tile>
              <span className="text-sm font-medium">{t("categories.list.new")}</span>
            </Link>
          </div>
          {archived.length > 0 && (
            <section className="flex flex-col gap-3">
              <Card flush>
                <button
                  type="button"
                  aria-expanded={archivedOpen}
                  aria-controls={archivedId}
                  onClick={() => {
                    setArchivedOpen((open) => !open);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium hover:bg-surface-2"
                >
                  <span className="flex-1">{t("categories.list.archived")}</span>
                  <Badge>{archived.length}</Badge>
                  <ChevronDown
                    {...iconProps("md")}
                    className={cn(
                      "text-text-3 transition-transform duration-(--dur-1) ease-(--ease)",
                      archivedOpen && "rotate-180",
                    )}
                  />
                </button>
              </Card>
              <Card flush id={archivedId} hidden={!archivedOpen}>
                <List>
                  {archived.map((category) => (
                    <Row key={category.id} className="opacity-70">
                      <Tile color={category.color}>
                        <CategoryIcon icon={category.icon} />
                      </Tile>
                      <RowBody>
                        <RowTitle>
                          <span>{category.name}</span>
                          <Badge>{t("categories.list.archivedBadge")}</Badge>
                        </RowTitle>
                        <RowMeta items={[t(`categoryTypes.${categoryType(category)}`)]} />
                      </RowBody>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`${t("categories.list.restore")} ${category.name}`}
                        loading={restore.isPending && restore.variables.id === category.id}
                        onClick={() => {
                          void restoreOne(category);
                        }}
                      >
                        {t("categories.list.restore")}
                      </Button>
                    </Row>
                  ))}
                </List>
              </Card>
            </section>
          )}
          <Alert
            tone="neutral"
            action={
              <Button
                variant="secondary"
                size="sm"
                disabled={offline}
                loading={restoreDefaults.isPending}
                onClick={() => {
                  void recreateDefaults();
                }}
              >
                <RotateCcw {...iconProps("sm")} />
                {t("categories.list.restoreDefaults.cta")}
              </Button>
            }
          >
            {t("categories.list.restoreDefaults.body")}{" "}
            {t("categories.list.restoreDefaults.onlineOnly")}
          </Alert>
          {conflict && (
            <RestoreCategoryConflictSheet
              category={conflict}
              conflict={findActiveCategoryByName(categories.data, conflict.name)}
              open
              pending={restore.isPending}
              error={conflictError}
              onConfirm={(name) => {
                void restoreOne(conflict, name);
              }}
              onClose={() => {
                setConflict(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
