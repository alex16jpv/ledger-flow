"use client";

import { Check, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, useState } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { Picker } from "@/components/ui/Picker";
import { List, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useMoney } from "@/lib/i18n/useMoney";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { useAccountsQuery } from "../hooks";

export interface AccountPickerProps {
  value: string | null;
  onChange: (account: Account) => void;
  label?: string;
  exclude?: string | null;
  disabled?: boolean;
  className?: string;
}

export function AccountPicker({
  value,
  onChange,
  label,
  exclude = null,
  disabled = false,
  className,
}: AccountPickerProps) {
  const t = useTranslations();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const accounts = useAccountsQuery();
  const selected = accounts.data?.find((account) => account.id === value) ?? null;
  const options = (accounts.data ?? []).filter((account) => account.id !== exclude);

  return (
    <>
      <Picker
        label={label ?? t("accounts.picker.label")}
        value={selected ? `${selected.name} · ${money.format(selected.balance)}` : undefined}
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
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={t("accounts.picker.title")}
        footer={<p className="text-sm text-text-3">{t("accounts.picker.note")}</p>}
      >
        <List className="-mx-4 max-h-[60dvh] overflow-y-auto">
          {accounts.isPending ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : accounts.isError ? (
            <Empty
              tone="danger"
              icon={<Wallet {...iconProps("lg")} />}
              title={t("states.error.title")}
              body={t("states.error.body")}
            />
          ) : options.length === 0 ? (
            <Empty icon={<Wallet {...iconProps("lg")} />} title={t("accounts.picker.empty")} />
          ) : (
            <div role="listbox" aria-label={t("accounts.picker.title")} className="flex flex-col">
              {options.map((account) => {
                const Icon = accountTypeIcon(account.type);
                const isSelected = account.id === value;
                return (
                  <RowButton
                    key={account.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(account);
                      setOpen(false);
                    }}
                    className={cn("border-t border-border", isSelected && "bg-brand-soft/40")}
                  >
                    <Tile color={account.color}>
                      <Icon {...iconProps("md")} />
                    </Tile>
                    <RowBody>
                      <RowTitle>
                        <span>{account.name}</span>
                        {account.isDefault && <Badge tone="brand">{t("common.main")}</Badge>}
                      </RowTitle>
                      <RowMeta items={[t(`accountTypes.${account.type}`)]} />
                    </RowBody>
                    <RowRight>
                      <span className="flex items-center gap-2">
                        <Amount value={account.balance} signed={false} />
                        {isSelected && <Check {...iconProps("sm")} className="text-brand-text" />}
                      </span>
                    </RowRight>
                  </RowButton>
                );
              })}
            </div>
          )}
        </List>
      </Sheet>
    </>
  );
}
