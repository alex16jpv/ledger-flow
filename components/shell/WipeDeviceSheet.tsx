"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet, SheetCancel } from "@/components/ui/Sheet";
import { countPendingElsewhere } from "@/lib/local/db";
import { currentVault } from "@/lib/local/repository";
import { reportError } from "@/lib/observability/reporter";

// P-32: the confirmation of the third exit, shared by the sheet and Sync status (DESIGN §8.17).
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
  const [elsewhere, setElsewhere] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let wanted = true;
    countPendingElsewhere(currentVault()?.userId).then(
      (count) => {
        if (wanted) setElsewhere(count);
      },
      (error: unknown) => {
        reportError(error, "vault");
        if (wanted) setElsewhere(0);
      },
    );
    return () => {
      wanted = false;
      setElsewhere(null);
    };
  }, [open]);

  return (
    <Sheet
      layout="dialog"
      open={open}
      onClose={onCancel}
      title={t("confirmTitle")}
      footer={
        <div className="flex gap-3">
          <SheetCancel className="flex-1" />
          <Button
            variant="dangerSolid"
            size="lg"
            className="flex-[1.4]"
            loading={wiping}
            disabled={elsewhere === null}
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
        {elsewhere ? ` ${t("confirmElsewhere", { count: elsewhere })}` : null}
      </Alert>
    </Sheet>
  );
}
