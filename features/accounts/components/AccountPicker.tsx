"use client";

import { Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, useState } from "react";

import { Picker } from "@/components/ui/Picker";
import { Tile } from "@/components/ui/Tile";
import { useMoney } from "@/lib/i18n/useMoney";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { useAccountsQuery } from "../hooks";
import { accountLead, AccountPickerSheet, type OutsideRow } from "./AccountPickerSheet";

export interface AccountPickerProps {
  value: string | null;
  onChange: (account: Account) => void;
  label?: string;
  exclude?: string | null;
  disabled?: boolean;
  allowCreate?: boolean;
  className?: string;
  outside?: OutsideRow;
}

export function AccountPicker({
  value,
  onChange,
  label,
  exclude = null,
  disabled = false,
  allowCreate = true,
  className,
  outside,
}: AccountPickerProps) {
  const t = useTranslations();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const accounts = useAccountsQuery(false, open || value !== null);
  const selected = (accounts.data ?? []).find((account) => account.id === value) ?? null;

  return (
    <>
      <Picker
        label={label ?? t("accounts.picker.label")}
        value={selected ? `${selected.name} · ${money.format(accountLead(selected))}` : undefined}
        placeholder={t("accounts.picker.placeholder")}
        disabled={disabled}
        className={className}
        onClick={() => {
          setOpen(true);
        }}
        leading={
          <Tile size="sm" color={selected?.color} variant={selected ? "soft" : "outline"}>
            {createElement(selected ? accountTypeIcon(selected.type) : Wallet, iconProps("sm"))}
          </Tile>
        }
      />
      <AccountPickerSheet
        open={open}
        value={value}
        exclude={exclude}
        allowCreate={allowCreate}
        outside={outside}
        onSelect={onChange}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
