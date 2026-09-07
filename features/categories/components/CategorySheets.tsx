"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { RenameRestoreSheet } from "@/components/ui/RenameRestoreSheet";
import { Sheet } from "@/components/ui/Sheet";
import type { Category } from "@/types/api";

import { CATEGORY_NAME_MAX } from "../schemas";

export function ArchiveCategorySheet({
  category,
  open,
  pending,
  onConfirm,
  onClose,
}: {
  category: Category;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("categories.archive");
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("title", { name: category.name })}
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

export function RestoreCategoryConflictSheet({
  category,
  conflict,
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  category: Category;
  conflict: Category | undefined;
  open: boolean;
  pending: boolean;
  error?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("categories.restoreConflict");
  return (
    <RenameRestoreSheet
      open={open}
      title={t("title")}
      body={t("body", { name: conflict?.name ?? category.name })}
      nameLabel={t("name")}
      confirmLabel={(name) => (name ? t("confirm", { name }) : t("confirmEmpty"))}
      currentName={category.name}
      maxLength={CATEGORY_NAME_MAX}
      pending={pending}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
