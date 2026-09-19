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
}

export function DeleteTransactionSheet({
  open,
  pending,
  onConfirm,
  onClose,
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
      <Alert tone="danger">{t("transactions.form.deleteBody")}</Alert>
    </Sheet>
  );
}
