"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { connectivityStore } from "@/lib/network/connectivity";

interface SessionExpiredSheetProps {
  open: boolean;
  // The device still holds this user's vault, so the app keeps working and the sheet is an offer,
  // not a wall (§2.6). Without a vault an expired session really is the end of the road.
  localMode?: boolean;
  onSignIn: () => void;
}

export function SessionExpiredSheet({
  open,
  localMode = false,
  onSignIn,
}: SessionExpiredSheetProps) {
  const t = useTranslations("states.sessionExpired");
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );
  // Asking someone with no network to sign in is asking for something they cannot do; the queue
  // keeps filling locally and the sheet waits until there is a network to sync over.
  const dismissible = localMode;
  if (localMode && phase === "offline") return null;

  return (
    <Sheet
      open={open}
      onClose={onSignIn}
      dismissible={dismissible}
      title={localMode ? t("localTitle") : t("title")}
      footer={
        <Button size="lg" block onClick={onSignIn}>
          {localMode ? t("localCta") : t("cta")}
        </Button>
      }
    >
      <Alert tone="warning">{localMode ? t("localBody") : t("body")}</Alert>
    </Sheet>
  );
}
