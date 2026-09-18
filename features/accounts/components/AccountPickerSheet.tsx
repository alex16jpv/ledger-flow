"use client";

import { Check, CircleDollarSign, Plus, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { createElement, useEffect, useRef, useState } from "react";

import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { Empty } from "@/components/ui/Empty";
import { LoadErrorBody } from "@/components/ui/LoadErrorBody";
import { List, RowBody, RowButton, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { readDebt } from "@/lib/accounts/debt";
import { accountTypeIcon } from "@/lib/icons/account-type-icons";
import { iconProps } from "@/lib/icons/sizes";
import type { Account } from "@/types/api";

import { useAccountsQuery } from "../hooks";
import { AccountForm } from "./AccountForm";

// A debt can be paid with money the app does not track: one row that is not an account.
export interface OutsideRow {
  label: string;
  meta: string;
  selected: boolean;
  onSelect: () => void;
}

export interface AccountPickerSheetProps {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onSelect: (account: Account) => void;
  exclude?: string | null;
  only?: ReadonlySet<Account["type"]>;
  allowCreate?: boolean;
  outside?: OutsideRow;
}

export function accountLead(account: Account): number {
  return readDebt(account)?.lead ?? account.balance;
}

export function AccountPickerSheet({
  open,
  onClose,
  value,
  onSelect,
  exclude = null,
  only,
  allowCreate = true,
  outside,
}: AccountPickerSheetProps) {
  const t = useTranslations();
  const [creating, setCreating] = useState(false);
  const initialFocus = useRef<HTMLButtonElement>(null);
  const focused = useRef(false);
  const accounts = useAccountsQuery(false, open || value !== null);
  const options = (accounts.data ?? []).filter(
    (account) => account.id !== exclude && (only === undefined || only.has(account.type)),
  );
  const focusedId = options.some((account) => account.id === value) ? value : options[0]?.id;
  const rowMeta = (account: Account): string[] => {
    const reading = readDebt(account);
    const type = t(`accountTypes.${account.type}`);
    return reading === null ? [type] : [t(`accounts.debt.${reading.word}`), type];
  };

  // showModal() lands on the close button; move focus to a row once the rows exist so Enter selects.
  useEffect(() => {
    if (!open) focused.current = false;
    if (open && !creating && !focused.current && initialFocus.current) {
      initialFocus.current.focus();
      focused.current = true;
    }
  }, [open, creating, accounts.data]);

  function close() {
    setCreating(false);
    onClose();
  }

  function choose(account: Account) {
    onSelect(account);
    close();
  }

  if (creating) {
    return (
      <Sheet open={open} onClose={close} title={t("accounts.form.title")}>
        <AccountForm
          submitLabel={t("accounts.form.create")}
          onSaved={choose}
          onCancel={() => {
            setCreating(false);
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("accounts.picker.title")}
      footer={
        <p className="text-sm text-text-3">
          {t("accounts.picker.note")}
          {outside ? ` ${t("accounts.picker.outsideNote")}` : ""}
        </p>
      }
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
            body={<LoadErrorBody error={accounts.error} />}
          />
        ) : options.length === 0 && !outside ? (
          <Empty icon={<Wallet {...iconProps("lg")} />} title={t("accounts.picker.empty")} />
        ) : (
          <div role="listbox" aria-label={t("accounts.picker.title")} className="flex flex-col">
            {options.map((account) => {
              const isSelected = account.id === value;
              return (
                <RowButton
                  key={account.id}
                  ref={account.id === focusedId ? initialFocus : undefined}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    choose(account);
                  }}
                  className={cn("border-t border-border", isSelected && "bg-brand-soft/40")}
                >
                  <Tile color={account.color}>
                    {createElement(accountTypeIcon(account.type), iconProps("md"))}
                  </Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{account.name}</span>
                      {account.isDefault && <Badge tone="brand">{t("common.main")}</Badge>}
                    </RowTitle>
                    <RowMeta items={rowMeta(account)} />
                  </RowBody>
                  <RowRight>
                    <span className="flex items-center gap-2">
                      <Amount value={accountLead(account)} signed={false} />
                      {isSelected && <Check {...iconProps("sm")} className="text-brand-text" />}
                    </span>
                  </RowRight>
                </RowButton>
              );
            })}
            {outside && (
              <RowButton
                ref={options.length === 0 ? initialFocus : undefined}
                role="option"
                aria-selected={outside.selected}
                onClick={() => {
                  outside.onSelect();
                  close();
                }}
                className={cn("border-t border-border", outside.selected && "bg-brand-soft/40")}
              >
                <Tile variant="outline">
                  <CircleDollarSign {...iconProps("md")} />
                </Tile>
                <RowBody>
                  <RowTitle>
                    <span>{outside.label}</span>
                  </RowTitle>
                  <RowMeta items={[outside.meta]} />
                </RowBody>
                {outside.selected && (
                  <RowRight>
                    <Check {...iconProps("sm")} className="text-brand-text" />
                  </RowRight>
                )}
              </RowButton>
            )}
          </div>
        )}
        {allowCreate && !accounts.isPending && (
          <RowButton
            ref={options.length === 0 ? initialFocus : undefined}
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
                <span>{t("accounts.picker.new")}</span>
              </RowTitle>
              <RowMeta items={[t("accounts.picker.newHint")]} />
            </RowBody>
          </RowButton>
        )}
      </List>
    </Sheet>
  );
}
