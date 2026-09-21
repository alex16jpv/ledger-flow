"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";

export interface DeleteTransactionSheetProps {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  // A movement in a shared group drags what everybody owes, and never a payment already made.
  shared?: boolean;
  onWriteOff?: () => void;
}

export function DeleteTransactionSheet({
  open,
  pending,
  onConfirm,
  onClose,
  shared = false,
  onWriteOff,
}: DeleteTransactionSheetProps) {
  const t = useTranslations();
  return (
    <Sheet
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
            <Alert tone="warning">{t("transactions.detail.shared.deleteWarning")}</Alert>
            <p className="text-sm text-text-3">{t("transactions.detail.shared.deleteWriteOff")}</p>
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
