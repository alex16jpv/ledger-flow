"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RenameRestoreSheet } from "@/components/ui/RenameRestoreSheet";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import type { Account } from "@/types/api";

import { ACCOUNT_NAME_MAX } from "../schemas";

interface ConfirmSheetProps {
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function MakeMainSheet({
  account,
  previous,
  open,
  pending,
  onConfirm,
  onClose,
}: ConfirmSheetProps & { account: Account; previous: Account | undefined }) {
  const t = useTranslations("accounts.main");
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("title", { name: account.name })}
      footer={
        <>
          <Button size="lg" block loading={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <Alert tone="warning">
        {t("body", { name: account.name })}
        {previous ? ` ${t("previous", { previous: previous.name })}` : null}
      </Alert>
    </Sheet>
  );
}

export function ArchiveAccountSheet({
  account,
  open,
  pending,
  onConfirm,
  onClose,
}: ConfirmSheetProps & { account: Account }) {
  const t = useTranslations("accounts.archive");
  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onClose}
      title={t("title", { name: account.name })}
      footer={
        <>
          <Button variant="dangerSolid" size="lg" block loading={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
          <SheetCancel />
        </>
      }
    >
      <Alert tone="warning">{t("body")}</Alert>
    </Sheet>
  );
}

export function RestoreConflictSheet({
  account,
  conflict,
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  account: Account;
  conflict: Account | undefined;
  open: boolean;
  pending: boolean;
  error?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("accounts.restoreConflict");
  return (
    <RenameRestoreSheet
      open={open}
      title={t("title")}
      body={t("body", { name: conflict?.name ?? account.name })}
      nameLabel={t("name")}
      confirmLabel={(name) => (name ? t("confirm", { name }) : t("confirmEmpty"))}
      currentName={account.name}
      maxLength={ACCOUNT_NAME_MAX}
      pending={pending}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
