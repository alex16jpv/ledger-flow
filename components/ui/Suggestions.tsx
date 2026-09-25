"use client";

import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "./cn";

export interface SuggestionRow {
  key: string;
  value: string;
  name: string;
  label: ReactNode;
  meta?: ReactNode;
}

export interface SuggestComboboxProps {
  role: "combobox";
  "aria-autocomplete": "list";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  "aria-activedescendant": string | undefined;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export interface SuggestionsProps {
  rows: readonly SuggestionRow[];
  query: string;
  label: string;
  onPick: (row: SuggestionRow) => void;
  children: (combobox: SuggestComboboxProps) => ReactNode;
  // In the flow at every width; a sheet keeps its scroll, a page lets it float from 600px up.
  float?: boolean;
  className?: string;
}

const keepFocus = (event: MouseEvent) => {
  event.preventDefault();
};

let pointerHeld = false;
let tracking = false;

function trackPointer(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  document.addEventListener(
    "pointerdown",
    () => {
      pointerHeld = true;
    },
    true,
  );
  for (const type of ["pointerup", "pointercancel"] as const) {
    document.addEventListener(
      type,
      () => {
        pointerHeld = false;
      },
      true,
    );
  }
}

export function Suggestions({
  rows,
  query,
  label,
  onPick,
  children,
  float = true,
  className,
}: SuggestionsProps) {
  const t = useTranslations("common");
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [highlighted, setHighlighted] = useState({ query, index: -1 });
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [announced, setAnnounced] = useState({ open: false, text: "" });
  const list = useRef<HTMLDivElement>(null);

  useEffect(trackPointer, []);

  const open = focused && rows.length > 0 && dismissedAt !== query;
  const active = highlighted.query === query ? Math.min(highlighted.index, rows.length - 1) : -1;
  if (announced.open !== open) {
    setAnnounced({ open, text: open ? t("suggestionsCount", { count: rows.length }) : "" });
  }

  // On a phone the list is in the flow under the keyboard: the page scrolls so it is in view.
  useEffect(() => {
    if (open) list.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function highlight(index: number) {
    setHighlighted({ query, index });
  }

  function pick(row: SuggestionRow) {
    setDismissedAt(row.value);
    highlight(-1);
    onPick(row);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (rows.length === 0) return;
      event.preventDefault();
      if (!open) {
        setDismissedAt(null);
        highlight(0);
      } else highlight(Math.min(active + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      if (!open) return;
      event.preventDefault();
      highlight(Math.max(active - 1, -1));
    } else if (event.key === "Enter") {
      const row = open ? rows[active] : undefined;
      if (!row) return;
      event.preventDefault();
      pick(row);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setDismissedAt(query);
    }
  }

  const combobox: SuggestComboboxProps = {
    role: "combobox",
    "aria-autocomplete": "list",
    "aria-expanded": open,
    "aria-controls": open ? listId : undefined,
    "aria-activedescendant": open && active >= 0 ? `${listId}-${active}` : undefined,
    onKeyDown,
    onFocus: () => {
      setFocused(true);
    },
    onBlur: () => {
      if (!pointerHeld) {
        setFocused(false);
        return;
      }
      // A list in the flow moves what is under it when it closes: a tap there lands first.
      const close = () => {
        document.removeEventListener("click", close);
        document.removeEventListener("pointercancel", close);
        setFocused(false);
      };
      document.addEventListener("click", close);
      document.addEventListener("pointercancel", close);
    },
  };

  return (
    <div className={cn("relative flex flex-col", className)}>
      {children(combobox)}
      {open && (
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          data-suggest=""
          onMouseDown={keepFocus}
          className={cn(
            "mt-1 flex flex-col overflow-hidden rounded-md border border-border-strong bg-surface shadow-2",
            float && "sm:absolute sm:inset-x-0 sm:top-full sm:z-10",
          )}
        >
          {rows.map((row, index) => (
            <button
              key={row.key}
              type="button"
              role="option"
              id={`${listId}-${index}`}
              aria-selected={index === active}
              aria-label={row.name}
              aria-describedby={row.meta === undefined ? undefined : `${listId}-${index}-meta`}
              tabIndex={-1}
              onClick={() => {
                pick(row);
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 [&+&]:border-t [&+&]:border-border",
                index === active && "bg-surface-2",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-field text-text">{row.label}</span>
                {row.meta !== undefined && (
                  <span id={`${listId}-${index}-meta`} className="truncate text-xs text-text-3">
                    {row.meta}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      <span aria-live="polite" className="sr-only">
        {announced.text}
      </span>
    </div>
  );
}
