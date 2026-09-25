"use client";

import { Plus, Search, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Field";
import { List, RowBody, rowClasses, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetAction, SheetCancel } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { useAccountsQuery } from "@/features/accounts/hooks";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { matchesSearch } from "@/features/transactions/filters";
import { useTransactionsInfinite } from "@/features/transactions/hooks";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import { iconProps } from "@/lib/icons/sizes";
import { sumAmounts } from "@/lib/local/derive/money";
import type { Transaction } from "@/types/api";

export interface TransactionPickerSheetProps {
  open: boolean;
  onClose: () => void;
  // What the form already holds, so reopening the sheet does not silently drop it.
  selected?: Transaction[];
  onDone: (transactions: Transaction[]) => void;
  // Offered only where there is a group to record it into: the form before one exists has none.
  onRecordNew?: () => void;
  // Offered only where somebody else could have paid: a group whose only participant is you cannot.
  onSomebodyElsePaid?: () => void;
}

export function TransactionPickerSheet({
  open,
  onClose,
  selected = [],
  onDone,
  onRecordNew,
  onSomebodyElsePaid,
}: TransactionPickerSheetProps) {
  const t = useTranslations("shared.pickExpenses");
  const loading = useTranslations("common")("loading");
  const money = useMoney();
  const dates = useDates();
  const list = useTransactionsInfinite({ type: "EXPENSE", limit: 20 }, open);
  const accounts = useAccountsQuery(true, open);
  const categories = useCategoriesQuery(undefined, open);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>(() => selected.map((row) => row.id));

  const rows = useMemo(() => {
    const needle = search.trim();
    return (list.data?.pages.flatMap((page) => page.data) ?? []).filter(
      // A movement already in a group is not offered again: it is one line, in one group.
      (row) => row.sharedExpenseId === null && matchesSearch(row, needle),
    );
  }, [list.data, search]);
  // A movement chosen before may not be on the page in front of you; it stays chosen all the same.
  const onPage = new Map(rows.map((row) => [row.id, row]));
  const chosen = picked.flatMap((id) => {
    const row = onPage.get(id) ?? selected.find((one) => one.id === id);
    return row ? [row] : [];
  });
  const total = sumAmounts(chosen.map((row) => row.amount));
  const lookups = {
    accounts: new Map((accounts.data ?? []).map((row) => [row.id, row])),
    categories: new Map((categories.data ?? []).map((row) => [row.id, row])),
  };

  return (
    <Sheet
      layout="full"
      open={open}
      onClose={onClose}
      title={t(onRecordNew ? "titleInGroup" : "title")}
      footer={
        <>
          <SheetAction
            block
            disabled={chosen.length === 0}
            onClick={() => {
              onDone(chosen);
            }}
          >
            {t("add", { count: chosen.length, amount: money.format(total) })}
          </SheetAction>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-3 max-sm:min-h-0 max-sm:flex-1">
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
        <div className="-mx-4 max-h-[320px] overflow-auto max-sm:max-h-none max-sm:min-h-0 max-sm:flex-1">
          {list.isPending && (
            <div
              className="flex flex-col gap-3 px-4 py-3"
              role="status"
              aria-busy="true"
              aria-label={loading}
            >
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}
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
        {list.isError && <p className="px-1 text-sm text-danger">{t("failed")}</p>}
        {rows.length === 0 && !list.isPending && !list.isError && (
          <p className="px-1 text-sm text-text-3">{t("none")}</p>
        )}
        {(onRecordNew ?? onSomebodyElsePaid) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {onRecordNew && (
              <Button variant="ghost" size="sm" onClick={onRecordNew}>
                <Plus {...iconProps("sm")} />
                {t("recordNew")}
              </Button>
            )}
            {onSomebodyElsePaid && (
              <Button variant="ghost" size="sm" onClick={onSomebodyElsePaid}>
                <Users {...iconProps("sm")} />
                {t("somebodyElsePaid")}
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
