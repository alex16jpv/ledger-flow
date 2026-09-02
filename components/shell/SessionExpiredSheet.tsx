"use client";

import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

interface SessionExpiredSheetProps {
  open: boolean;
  onSignIn: () => void;
}

export function SessionExpiredSheet({ open, onSignIn }: SessionExpiredSheetProps) {
  const t = useTranslations("states.sessionExpired");
  return (
    <Sheet
      open={open}
      onClose={onSignIn}
      dismissible={false}
      title={t("title")}
      footer={
        <Button size="lg" block onClick={onSignIn}>
          {t("cta")}
        </Button>
      }
    >
      <Alert tone="warning">{t("body")}</Alert>
    </Sheet>
  );
}
