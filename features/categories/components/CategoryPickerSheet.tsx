"use client";

import { Check, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { CategoryChip, ChipRow } from "@/components/ui/Chip";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { Input } from "@/components/ui/Field";
import { List, RowBody, RowButton, RowMeta, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Category } from "@/types/api";

import type { CategoryType } from "../api";
import { RECENT_LIMIT, useCategoriesQuery, useRecentCategories } from "../hooks";
import { CategoryQuickForm } from "./CategoryQuickForm";

export interface CategoryPickerSheetProps {
  open: boolean;
  onClose: () => void;
  type: CategoryType;
  value: string | null;
  onSelect: (category: Category) => void;
  allowCreate?: boolean;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CategoryPickerSheet({
  open,
  onClose,
  type,
  value,
  onSelect,
  allowCreate = true,
}: CategoryPickerSheetProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const categories = useCategoriesQuery(type, open);
  const recent = useRecentCategories(type, categories.data, RECENT_LIMIT, open);
  const needle = normalize(query.trim());
  const filtered = useMemo(
    () =>
      (categories.data ?? []).filter(
        (category) => needle.length === 0 || normalize(category.name).includes(needle),
      ),
    [categories.data, needle],
  );

  function close() {
    setQuery("");
    setCreating(false);
    onClose();
  }

  function choose(category: Category) {
    onSelect(category);
    close();
  }

  if (creating) {
    return (
      <Sheet open={open} onClose={close} title={t("categories.form.title")}>
        <CategoryQuickForm
          type={type}
          initialName={query.trim()}
          onCreated={choose}
          onCancel={() => {
            setCreating(false);
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={t("categories.picker.title")}>
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder={t("categories.picker.search")}
          aria-label={t("categories.picker.search")}
          leading={<Search {...iconProps("sm")} />}
          autoComplete="off"
          autoFocus
        />
        {recent.length > 0 && needle.length === 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-[0.04em] text-text-3 uppercase">
              {t("common.recent")}
            </span>
            <ChipRow role="group" aria-label={t("common.recent")}>
              {recent.map((category) => (
                <CategoryChip
                  key={category.id}
                  color={category.color}
                  selected={category.id === value}
                  icon={<CategoryIcon icon={category.icon} size="sm" />}
                  onClick={() => {
                    choose(category);
                  }}
                >
                  {category.name}
                </CategoryChip>
              ))}
            </ChipRow>
          </div>
        )}
        <List className="-mx-4 max-h-[55dvh] overflow-y-auto">
          {categories.isPending ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : categories.isError ? (
            <Empty
              tone="danger"
              icon={<Search {...iconProps("lg")} />}
              title={t("states.error.title")}
              body={t("states.error.body")}
            />
          ) : filtered.length === 0 ? (
            <Empty
              icon={<Search {...iconProps("lg")} />}
              title={
                needle.length === 0
                  ? t("categories.picker.empty")
                  : t("categories.picker.noMatch", { query: query.trim() })
              }
            />
          ) : (
            <div role="listbox" aria-label={t("categories.picker.title")} className="flex flex-col">
              {filtered.map((category) => {
                const selected = category.id === value;
                return (
                  <RowButton
                    key={category.id}
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      choose(category);
                    }}
                    className={cn("border-t border-border", selected && "bg-brand-soft/40")}
                  >
                    <Tile color={category.color}>
                      <CategoryIcon icon={category.icon} />
                    </Tile>
                    <RowBody>
                      <RowTitle>
                        <span>{category.name}</span>
                      </RowTitle>
                      {category.type && <RowMeta items={[t(`categoryTypes.${category.type}`)]} />}
                    </RowBody>
                    {selected && <Check {...iconProps("md")} className="text-brand-text" />}
                  </RowButton>
                );
              })}
            </div>
          )}
          {allowCreate && !categories.isPending && (
            <RowButton
              onClick={() => {
                setCreating(true);
              }}
              className="border-t border-border"
            >
              <Tile variant="outline">
                <Plus {...iconProps("md")} />
              </Tile>
              <RowBody>
                <RowTitle className="text-brand-text">
                  <span>{t("categories.picker.new")}</span>
                </RowTitle>
                <RowMeta items={[t("categories.picker.newHint")]} />
              </RowBody>
            </RowButton>
          )}
        </List>
      </div>
    </Sheet>
  );
}
