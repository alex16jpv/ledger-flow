"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";

export function HumanCheckFailed({ className }: { className?: string }) {
  const t = useTranslations("auth.humanCheck");
  return (
    <Alert tone="danger" title={t("failedTitle")} className={className}>
      {t("failedBody")}
    </Alert>
  );
}
