"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

// P-32: the confirmation of the third exit, shared by the sheet that offers it when there is no
// session and by Sync status, which keeps that exit reachable at any time (DESIGN §8.17).
export function WipeDeviceSheet({
  open,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: number;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const t = useTranslations("states.noSession");
  const [wiping, setWiping] = useState(false);

  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={t("confirmTitle")}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" size="lg" className="flex-1" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            variant="dangerSolid"
            size="lg"
            className="flex-[1.4]"
            loading={wiping}
            onClick={() => {
              setWiping(true);
              void Promise.resolve(onConfirm());
            }}
          >
            {t("confirmCta")}
          </Button>
        </div>
      }
    >
      <Alert tone="danger">
        {pending > 0 ? t("confirmBody", { count: pending }) : t("confirmBodyEmpty")}
      </Alert>
    </Sheet>
  );
}
