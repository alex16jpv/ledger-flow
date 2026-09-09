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

// P-32 (owner, 2026-09-08): a device with a copy of the user's data and no session used to get an
// invitation to sign in. It gets a decision now, with three exits, and none of them is a dead end:
// sign in, keep working here, or delete what this device holds (DESIGN §8.17).
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
  // §8.17, same rule §8.15 had: two of the three exits need a network, and asking a question whose
  // main answer cannot be given is a wall. The app keeps working and the stripe says what is going
  // on; the two exits that work with no network live in Sync status for good.
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
    // The one sheet in the app that cannot be closed without answering: closing it would put the
    // user back in the state P-32 exists to remove.
    <Sheet open={open} onClose={onSignIn} dismissible={false} title={t("title")}>
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
