"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { useMoney } from "@/lib/i18n/useMoney";
import type { Settlement } from "@/types/api";

export interface UndoPaymentSheetProps {
  settlement: Settlement;
  name: string;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function UndoPaymentSheet({
  settlement,
  name,
  open,
  pending,
  onConfirm,
  onClose,
}: UndoPaymentSheetProps) {
  const t = useTranslations("shared.undoPayment");
  const money = useMoney();
  // A full settle-up between two people carries both halves, and both of them go back.
  const both = settlement.collected > 0 && settlement.paid > 0;
  const goesBack = both
    ? t("goesBackBoth", {
        collected: money.format(settlement.collected),
        paid: money.format(settlement.paid),
      })
    : t(settlement.collected > 0 ? "goesBackIn" : "goesBackOut", {
        amount: money.format(settlement.collected > 0 ? settlement.collected : settlement.paid),
      });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title")}
      footer={
        <>
          <Button size="lg" block variant="dangerSolid" loading={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title={goesBack}>
          {t("notARefund")}
        </Alert>
        <p className="text-sm text-text-3">
          {t(settlement.outsideApp ? "wroteNoMovement" : "movementGoesWithIt")} {t("countsAsYours")}
        </p>
        <p className="text-sm text-text-3">
          {name ? t("nothingElse", { name }) : t("nothingElseUnnamed")}
        </p>
      </div>
    </Sheet>
  );
}
