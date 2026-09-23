"use client";

import { CloudOff, LogIn, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { iconProps } from "@/lib/icons/sizes";
import { connectivityStore } from "@/lib/network/connectivity";

import { WipeDeviceSheet } from "./WipeDeviceSheet";

// P-32 (owner, 2026-09-08): a decision with three exits, none of them a dead end (DESIGN §8.17).
export interface NoSessionChoiceSheetProps {
  open: boolean;
  pending: number;
  onSignIn: () => void;
  onStayLocal: () => void;
  onWipe: () => Promise<void> | void;
}

export function NoSessionChoiceSheet({
  open,
  pending,
  onSignIn,
  onStayLocal,
  onWipe,
}: NoSessionChoiceSheetProps) {
  const t = useTranslations("states.noSession");
  const [confirming, setConfirming] = useState(false);
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );
  // §8.17: two of the three exits need a network, and an unanswerable question is a wall.
  if (phase === "offline" && !confirming) return null;

  if (confirming) {
    return (
      <WipeDeviceSheet
        open={open}
        pending={pending}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={onWipe}
      />
    );
  }

  return (
    // The one sheet that cannot be closed without answering (P-32).
    <Sheet layout="dialog" open={open} onClose={onSignIn} dismissible={false} title={t("title")}>
      <div className="flex flex-col gap-4">
        <Alert tone="warning">{pending > 0 ? t("body", { count: pending }) : t("bodyEmpty")}</Alert>
        <div className="flex flex-col gap-1.5">
          <Button size="lg" block onClick={onSignIn}>
            <LogIn {...iconProps("sm")} />
            {t("signIn")}
          </Button>
          <p className="text-xs text-text-3">{t("signInHelp")}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button size="lg" block variant="secondary" onClick={onStayLocal}>
            <CloudOff {...iconProps("sm")} />
            {t("stay")}
          </Button>
          <p className="text-xs text-text-3">
            {t("stayHelp")} <b className="font-semibold">{t("stayWarning")}</b>
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Button
            size="lg"
            block
            variant="ghost"
            className="text-danger"
            onClick={() => {
              setConfirming(true);
            }}
          >
            <Trash2 {...iconProps("sm")} />
            {t("wipe")}
          </Button>
          <p className="text-xs text-text-3">{t("wipeHelp", { count: pending })}</p>
        </div>
      </div>
    </Sheet>
  );
}
