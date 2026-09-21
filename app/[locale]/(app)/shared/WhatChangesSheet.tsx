"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { useCategoriesQuery } from "@/features/categories/hooks";
import { useDates } from "@/lib/i18n/useDates";
import { useMoney } from "@/lib/i18n/useMoney";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import type { Transaction } from "@/types/api";

export interface WhatChangesSheetProps {
  open: boolean;
  onClose: () => void;
  groupName: string;
  transactions: Transaction[];
  pending: boolean;
  onConfirm: () => void;
}

// This has to be said before saving, and the surprising part is that nothing changes today.
export function WhatChangesSheet({
  open,
  onClose,
  groupName,
  transactions,
  pending,
  onConfirm,
}: WhatChangesSheetProps) {
  const t = useTranslations("shared.whatChanges");
  const money = useMoney();
  const dates = useDates();
  const categories = useCategoriesQuery(undefined, open);
  const byId = new Map((categories.data ?? []).map((row) => [row.id, row]));
  const total = transactions.reduce((sum, row) => sum + row.amount, 0);
  const names = [
    ...new Set(transactions.map((row) => byId.get(row.categoryId ?? "")?.name).filter(Boolean)),
  ].join(", ");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title", { count: transactions.length, name: groupName })}
      footer={
        <>
          <Button size="lg" block loading={pending} onClick={onConfirm}>
            {t("confirm", { count: transactions.length })}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert tone="info">
          {t("nothingChanges", { amount: money.format(total), categories: names })}
        </Alert>
        <Card flush>
          <List>
            {transactions.map((row) => {
              const category = byId.get(row.categoryId ?? "");
              return (
                <Row key={row.id}>
                  <Tile color={category?.color}>
                    <CategoryIcon icon={category?.icon} />
                  </Tile>
                  <RowBody>
                    <RowTitle>
                      <span>{row.description ?? category?.name ?? ""}</span>
                    </RowTitle>
                    <RowMeta
                      items={[dates.formatDay(new Date(row.date)), category?.name].filter(Boolean)}
                    />
                  </RowBody>
                  <RowRight sub={t("yoursUntilPaid")}>
                    <Amount value={row.amount} kind="expense" signed={false} />
                  </RowRight>
                </Row>
              );
            })}
          </List>
        </Card>
        <p className="text-sm text-text-3">{t("whenSomebodyPays")}</p>
      </div>
    </Sheet>
  );
}
