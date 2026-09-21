"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Field";
import { List, RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { matchesSearch } from "@/features/transactions/filters";
import { useTransactionsInfinite } from "@/features/transactions/hooks";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import type { Transaction } from "@/types/api";

export interface TransactionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  onDone: (transactions: Transaction[]) => void;
}

export function TransactionPickerSheet({ open, onClose, onDone }: TransactionPickerSheetProps) {
  const t = useTranslations("shared.pickExpenses");
  const money = useMoney();
  const dates = useDates();
  const list = useTransactionsInfinite({ type: "EXPENSE", limit: 20 }, open);
  const accounts = useAccountsQuery(true, open);
  const categories = useCategoriesQuery(undefined, open);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const rows = useMemo(() => {
    const needle = search.trim();
    return (list.data?.pages.flatMap((page) => page.data) ?? []).filter(
      // A movement already in a group is not offered again: it is one line, in one group.
      (row) => row.sharedExpenseId === null && matchesSearch(row, needle),
    );
  }, [list.data, search]);
  const chosen = rows.filter((row) => picked.includes(row.id));
  const total = chosen.reduce((sum, row) => sum + row.amount, 0);
  const lookups = {
    accounts: new Map((accounts.data ?? []).map((row) => [row.id, row])),
    categories: new Map((categories.data ?? []).map((row) => [row.id, row])),
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title")}
      footer={
        <>
          <Button
            size="lg"
            block
            disabled={chosen.length === 0}
            onClick={() => {
              onDone(chosen);
              setPicked([]);
            }}
          >
            {t("add", { count: chosen.length, amount: money.format(total) })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          type="search"
          leading={<Search {...iconProps("sm")} />}
          placeholder={t("search")}
          value={search}
          aria-label={t("search")}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <div className="-mx-4 max-h-[320px] overflow-auto">
          <List>
            {rows.map((row) => {
              const on = picked.includes(row.id);
              const category = lookups.categories.get(row.categoryId ?? "");
              const account = lookups.accounts.get(row.fromAccountId ?? "");
              return (
                <Checkbox
                  key={row.id}
                  checked={on}
                  className={rowClasses({ interactive: true })}
                  onChange={() => {
                    setPicked((was) => (on ? was.filter((id) => id !== row.id) : [...was, row.id]));
                  }}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Tile color={category?.color}>
                      <CategoryIcon icon={category?.icon} />
                    </Tile>
                    <RowBody>
                      <RowTitle>
                        <span>{row.description ?? category?.name ?? t("noDescription")}</span>
                      </RowTitle>
                      <RowMeta
                        items={[dates.formatDay(new Date(row.date)), account?.name].filter(Boolean)}
                      />
                    </RowBody>
                    <RowRight>
                      <Amount value={row.amount} kind="expense" signed={false} />
                    </RowRight>
                  </span>
                </Checkbox>
              );
            })}
          </List>
        </div>
        {list.hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            loading={list.isFetchingNextPage}
            onClick={() => {
              void list.fetchNextPage();
            }}
          >
            {t("loadMore")}
          </Button>
        )}
        {rows.length === 0 && !list.isPending && (
          <p className="px-1 text-sm text-text-3">{t("none")}</p>
        )}
      </div>
    </Sheet>
  );
}
