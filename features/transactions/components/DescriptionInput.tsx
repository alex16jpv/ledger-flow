"use client";

import { PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Ref, useState } from "react";

import { Input } from "@/components/ui/Field";
import { Suggestions } from "@/components/ui/Suggestions";
import { iconProps } from "@/lib/icons/sizes";

import { type ExcludedRow, type SuggestType, useDescriptionSuggestions } from "../suggest";

export const DESCRIPTION_MAX_LENGTH = 255;

export interface DescriptionInputProps {
  value: string;
  onChange: (text: string) => void;
  onBlur?: () => void;
  type: SuggestType | null;
  exclude?: ExcludedRow;
  placeholder: string;
  "aria-label"?: string;
  name?: string;
  float?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
}

export function DescriptionInput({
  value,
  onChange,
  onBlur,
  type,
  exclude,
  placeholder,
  "aria-label": ariaLabel,
  name,
  float,
  className,
  ref,
}: DescriptionInputProps) {
  const t = useTranslations("common");
  const [wanted, setWanted] = useState(false);
  const rows = useDescriptionSuggestions({ type, query: value, wanted, exclude });
  return (
    <Suggestions
      rows={rows}
      query={value}
      label={t("suggestions")}
      float={float}
      onPick={(row) => {
        onChange(row.value);
      }}
    >
      {(combobox) => (
        <Input
          ref={ref}
          name={name}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoComplete="off"
          maxLength={DESCRIPTION_MAX_LENGTH}
          leading={<PencilLine {...iconProps("sm")} />}
          className={className}
          {...combobox}
          onFocus={() => {
            setWanted(true);
            combobox.onFocus();
          }}
          onBlur={() => {
            combobox.onBlur();
            onBlur?.();
          }}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      )}
    </Suggestions>
  );
}
