"use client";

import { HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody, RowMeta, RowRight, RowTitle } from "@/components/ui/Row";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { Tile } from "@/components/ui/Tile";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";
import { fromCents, toCents } from "@/lib/local/derive/money";

export interface SharedDeleteImpact {
  groupName: string;
  accountName: string;
  amount: number;
  cost: number;
  arrived: number;
  rows: { key: string; name: string; paid: number; wouldOwe: number }[];
}

export interface DeleteTransactionSheetProps {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  // A movement in a shared group drags what everybody owes, and never a payment already made.
  shared?: SharedDeleteImpact;
  onWriteOff?: () => void;
}

export function DeleteTransactionSheet({
  open,
  pending,
  onConfirm,
  onClose,
  shared,
  onWriteOff,
}: DeleteTransactionSheetProps) {
  const t = useTranslations();
  const money = useMoney();
  const ahead = (row: { paid: number; wouldOwe: number }): number =>
    fromCents(toCents(row.paid) - toCents(row.wouldOwe));
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("transactions.form.deleteTitle")}
      footer={
        <>
          <Button variant="dangerSolid" size="lg" block loading={pending} onClick={onConfirm}>
            {t("common.delete")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert tone="danger">{t("transactions.form.deleteBody")}</Alert>
        {shared && (
          <>
            <Alert tone="danger" title={t("transactions.detail.shared.deleteChangesOwed")}>
              {t("transactions.detail.shared.deleteCost", {
                name: shared.groupName,
                cost: money.format(shared.cost),
              })}
            </Alert>
            <Alert tone="neutral" title={t("transactions.detail.shared.deleteNoPayment")}>
              {t("transactions.detail.shared.deleteArrived", {
                amount: money.format(shared.arrived),
              })}
            </Alert>
            <Card flush>
              <List>
                {shared.rows.map((row) => (
                  <Row key={row.key}>
                    <Tile color="GRAY">
                      <HandCoins {...iconProps("md")} />
                    </Tile>
                    <RowBody>
                      <RowTitle>
                        <span>{row.name}</span>
                      </RowTitle>
                      <RowMeta
                        items={[
                          t("transactions.detail.shared.deleteRow", {
                            paid: money.format(row.paid),
                            owed: money.format(row.wouldOwe),
                          }),
                        ]}
                      />
                    </RowBody>
                    <RowRight
                      sub={t(
                        ahead(row) > 0
                          ? "transactions.detail.shared.aheadSub"
                          : "transactions.detail.shared.stillOwedSub",
                      )}
                    >
                      <Amount value={Math.abs(ahead(row))} signed={false} />
                    </RowRight>
                  </Row>
                ))}
              </List>
            </Card>
            <p className="text-sm text-text-3">
              {t("transactions.detail.shared.deleteGoesBack", {
                account: shared.accountName,
                amount: money.format(shared.amount),
              })}{" "}
              {t("transactions.detail.shared.deleteWriteOff")}
            </p>
            {onWriteOff && (
              <Button variant="secondary" onClick={onWriteOff}>
                {t("transactions.detail.shared.writeOffInstead")}
              </Button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
