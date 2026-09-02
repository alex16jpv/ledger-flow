"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Link } from "@/lib/i18n/navigation";
import type { Account } from "@/types/api";

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
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title", { name: account.name })}
      footer={
        <>
          <Button size="lg" block loading={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {tc("cancel")}
          </Button>
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
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title", { name: account.name })}
      footer={
        <>
          <Button variant="dangerSolid" size="lg" block loading={pending} onClick={onConfirm}>
            {t("confirm")}
          </Button>
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {tc("cancel")}
          </Button>
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
  onClose,
}: {
  account: Account;
  conflict: Account | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("accounts.restoreConflict");
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title")}
      footer={
        <>
          {conflict && (
            <Link
              href={`/accounts/${conflict.id}/edit`}
              className={buttonClasses({ size: "lg", block: true })}
            >
              {t("open", { name: conflict.name })}
            </Link>
          )}
          <Button variant="ghost" size="lg" block onClick={onClose}>
            {tc("close")}
          </Button>
        </>
      }
    >
      <Alert tone="danger">{t("body", { name: conflict?.name ?? account.name })}</Alert>
    </Sheet>
  );
}
