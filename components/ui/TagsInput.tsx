"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useId, useState } from "react";

import { Chip, ChipRow } from "./Chip";
import { cn } from "./cn";
import { INPUT, useFieldContext } from "./Field";

export const TAG_MAX_LENGTH = 50;
export const TAGS_MAX = 30;

export interface TagsInputProps {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#+/, "").slice(0, TAG_MAX_LENGTH);
}

export function TagsInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  disabled = false,
  className,
}: TagsInputProps) {
  const t = useTranslations("common");
  const field = useFieldContext();
  const fallbackId = useId();
  const id = field?.id ?? fallbackId;
  const [draft, setDraft] = useState("");
  const needle = normalizeTag(draft);
  const full = value.length >= TAGS_MAX;
  const matching = suggestions
    .filter((tag) => !value.includes(tag) && (needle.length === 0 || tag.includes(needle)))
    .slice(0, 8);

  function add(raw: string) {
    const tag = normalizeTag(raw);
    setDraft("");
    if (!tag || value.includes(tag) || full) return;
    onChange([...value, tag]);
  }

  function remove(tag: string) {
    onChange(value.filter((item) => item !== tag));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && draft.trim()) {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          INPUT,
          "h-auto min-h-(--control-lg) flex-wrap py-2",
          field?.invalid && "border-danger-solid",
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) document.getElementById(id)?.focus();
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex h-[22px] items-center gap-0.5 rounded-sm bg-surface-2 pr-1 pl-2 text-xs font-medium text-text-2"
          >
            <span aria-hidden="true" className="mr-px text-text-3">
              #
            </span>
            {tag}
            <button
              type="button"
              aria-label={t("removeTag", { tag })}
              disabled={disabled}
              onClick={() => {
                remove(tag);
              }}
              className="grid size-4 place-items-center rounded-full text-text-3 hover:bg-surface-3 hover:text-text focus-visible:shadow-[0_0_0_2px_var(--focus-ring)] focus-visible:outline-none"
            >
              <X size={11} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled || full}
          maxLength={TAG_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="none"
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid ? true : undefined}
          placeholder={full ? undefined : placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
          className="min-w-[6ch] flex-1 bg-transparent text-md outline-none placeholder:text-text-3"
        />
      </div>
      {matching.length > 0 && !full && (
        <ChipRow role="group" aria-label={t("suggestions")}>
          {matching.map((tag) => (
            <Chip
              key={tag}
              disabled={disabled}
              onClick={() => {
                add(tag);
              }}
            >
              <span aria-hidden="true" className="text-text-3">
                #
              </span>
              {tag}
            </Chip>
          ))}
        </ChipRow>
      )}
    </div>
  );
}
