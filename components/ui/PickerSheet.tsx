"use client";

import { Check, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo, useState } from "react";

import { iconProps } from "@/lib/icons/sizes";

import { cn } from "./cn";
import { Empty } from "./Empty";
import { Input } from "./Field";
import { List, RowBody, RowButton, RowMeta, RowTitle } from "./Row";
import { Sheet } from "./Sheet";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  keywords?: string;
  leading?: ReactNode;
}

export interface PickerSheetProps<T extends string> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  options: readonly PickerOption<T>[];
  value: T | null;
  onSelect: (value: T) => void;
  searchable?: boolean;
  emptyTitle?: ReactNode;
  footer?: ReactNode;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function PickerSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  value,
  onSelect,
  searchable = true,
  emptyTitle,
  footer,
}: PickerSheetProps<T>) {
  const t = useTranslations("common");
  const [query, setQuery] = useState("");
  const needle = normalize(query.trim());
  const filtered = useMemo(
    () =>
      needle.length === 0
        ? options
        : options.filter((option) =>
            normalize(
              `${option.label} ${option.description ?? ""} ${option.keywords ?? ""}`,
            ).includes(needle),
          ),
    [options, needle],
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="flex flex-col gap-3">
        {searchable && (
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={t("search")}
            aria-label={t("search")}
            leading={<Search {...iconProps("sm")} />}
            autoComplete="off"
          />
        )}
        {filtered.length === 0 ? (
          <Empty icon={<Search {...iconProps("lg")} />} title={emptyTitle ?? t("noResults")} />
        ) : (
          <List
            className="max-h-[60dvh] overflow-y-auto"
            role="listbox"
            aria-label={typeof title === "string" ? title : undefined}
          >
            {filtered.slice(0, 200).map((option) => {
              const selected = option.value === value;
              return (
                <RowButton
                  key={option.value}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                  className={cn("min-h-12 rounded-md py-2", selected && "bg-brand-soft/40")}
                >
                  {option.leading}
                  <RowBody>
                    <RowTitle>
                      <span>{option.label}</span>
                    </RowTitle>
                    {option.description && <RowMeta items={[option.description]} />}
                  </RowBody>
                  {selected && <Check {...iconProps("md")} className="text-brand-text" />}
                </RowButton>
              );
            })}
          </List>
        )}
      </div>
    </Sheet>
  );
}
