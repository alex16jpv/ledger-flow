"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { CATEGORY_ICON_KEYS, type CategoryIconKey } from "@/lib/icons/category-icons";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { type ColorToken, featureColorStyle } from "@/lib/theme/feature-color";

import { cn } from "./cn";
import { Input } from "./Field";

export interface IconGridProps {
  value: CategoryIconKey | null;
  onChange: (icon: CategoryIconKey) => void;
  label: string;
  searchLabel: string;
  color?: ColorToken | null;
  className?: string;
}

export function IconGrid({ value, onChange, label, searchLabel, color, className }: IconGridProps) {
  const t = useTranslations("common");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase().replace(/\s+/g, "-");
  const keys = useMemo(
    () => (needle ? CATEGORY_ICON_KEYS.filter((key) => key.includes(needle)) : CATEGORY_ICON_KEYS),
    [needle],
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        placeholder={searchLabel}
        aria-label={searchLabel}
        leading={<Search {...iconProps("sm")} />}
        autoComplete="off"
        className="h-10"
      />
      {keys.length === 0 ? (
        <p className="py-3 text-center text-sm text-text-3">{t("noResults")}</p>
      ) : (
        <div
          role="group"
          aria-label={label}
          className="flex max-h-40 flex-wrap gap-2 overflow-y-auto p-1"
        >
          {keys.map((key) => {
            const selected = key === value;
            return (
              <button
                key={key}
                type="button"
                ref={(element) => {
                  if (selected) element?.scrollIntoView({ block: "nearest" });
                }}
                aria-label={key}
                aria-pressed={selected}
                style={featureColorStyle(color)}
                onClick={() => {
                  onChange(key);
                }}
                className={cn(
                  "grid size-10 place-items-center rounded-[12px] transition-[background,color,outline-color] duration-(--dur-1) ease-(--ease) focus-visible:shadow-[0_0_0_3px_var(--focus-ring)] focus-visible:outline-none",
                  selected
                    ? "bg-(--f-soft) text-(--f-text) outline-2 outline-offset-2 outline-(--f)"
                    : "bg-surface-2 text-text-2 hover:bg-surface-3",
                )}
              >
                <CategoryIcon icon={key} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
