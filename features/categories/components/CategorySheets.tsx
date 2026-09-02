"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Link } from "@/lib/i18n/navigation";
import type { Category } from "@/types/api";

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
  onClose,
}: {
  category: Category;
  conflict: Category | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("categories.restoreConflict");
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
              href={`/categories/${conflict.id}/edit`}
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
      <Alert tone="danger">{t("body", { name: conflict?.name ?? category.name })}</Alert>
    </Sheet>
  );
}
