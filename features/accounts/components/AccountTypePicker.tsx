"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createElement, useState } from "react";

import { cn } from "@/components/ui/cn";
import { Picker } from "@/components/ui/Picker";
import { List, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";

import { ACCOUNT_TYPES, type AccountType } from "../schemas";

export interface AccountTypePickerProps {
  value: AccountType;
  onChange: (type: AccountType) => void;
  label: string;
  error?: string;
}

// F-03, variant C (owner, 2026-09-06): one control for the form and the onboarding (§8.4, §8.6).
export function AccountTypePicker({ value, onChange, label, error }: AccountTypePickerProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // The description reads as a sentence in the sheet and as a trailing clause on the row.
  const clause = (text: string) => text.charAt(0).toLocaleLowerCase(locale) + text.slice(1);
  const describe = (type: AccountType) => t(`accountTypeDescriptions.${type}`);

  return (
    <>
      <Picker
        label={label}
        value={`${t(`accountTypes.${value}`)} · ${clause(describe(value))}`}
        aria-invalid={error ? true : undefined}
        onClick={() => {
          setOpen(true);
        }}
        leading={
          <Tile size="sm" variant="soft">
            {createElement(accountTypeIcon(value), iconProps("sm"))}
          </Tile>
        }
      />
      {error && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
      <Sheet
        layout="full"
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={t("accounts.typePicker.title")}
      >
        <List className="-mx-4 max-h-[60dvh] overflow-y-auto max-sm:max-h-none max-sm:min-h-0 max-sm:flex-1">
          <div role="listbox" aria-label={t("accounts.typePicker.title")} className="flex flex-col">
            {ACCOUNT_TYPES.map((type) => {
              const selected = type === value;
              return (
                <RowButton
                  key={type}
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(type);
                    setOpen(false);
                  }}
                  className={cn("border-t border-border", selected && "bg-brand-soft/40")}
                >
                  <Tile>{createElement(accountTypeIcon(type), iconProps("md"))}</Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{t(`accountTypes.${type}`)}</span>
                    </RowTitle>
                    <RowMeta items={[describe(type)]} />
                  </RowBody>
                  {selected && (
                    <RowRight>
                      <Check {...iconProps("md")} className="text-brand" />
                    </RowRight>
                  )}
                </RowButton>
              );
            })}
          </div>
        </List>
      </Sheet>
    </>
  );
}
