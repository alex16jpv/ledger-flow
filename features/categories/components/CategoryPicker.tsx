"use client";

import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Picker } from "@/components/ui/Picker";
import { Tile } from "@/components/ui/Tile";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Category } from "@/types/api";

import type { CategoryType } from "../api";
import { useCategoriesQuery } from "../hooks";
import { CategoryPickerSheet } from "./CategoryPickerSheet";

export interface CategoryPickerProps {
  type: CategoryType;
  value: string | null;
  onChange: (category: Category) => void;
  label?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  className?: string;
}

export function CategoryPicker({
  type,
  value,
  onChange,
  label,
  disabled = false,
  allowCreate = true,
  className,
}: CategoryPickerProps) {
  const t = useTranslations("categories.picker");
  const [open, setOpen] = useState(false);
  const categories = useCategoriesQuery(type);
  const selected = categories.data?.find((category) => category.id === value) ?? null;

  return (
    <>
      <Picker
        label={label ?? t("label")}
        value={selected?.name}
        placeholder={t("placeholder")}
        disabled={disabled}
        className={className}
        onClick={() => {
          setOpen(true);
        }}
        leading={
          selected ? (
            <Tile size="sm" color={selected.color}>
              <CategoryIcon icon={selected.icon} size="sm" />
            </Tile>
          ) : (
            <Tile size="sm" variant="outline">
              <Tag {...iconProps("sm")} />
            </Tile>
          )
        }
      />
      <CategoryPickerSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        type={type}
        value={value}
        onSelect={onChange}
        allowCreate={allowCreate}
      />
    </>
  );
}
