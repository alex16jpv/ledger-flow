"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { connectivityStore } from "@/lib/network/connectivity";

interface SessionExpiredSheetProps {
  open: boolean;
  // §2.6: with a vault on the device the sheet is an offer; without one it is the end of the road.
  localMode?: boolean;
  onSignIn: () => void;
  // F-41: closing closes — the `signedout` stripe stays behind it as the way back.
  onClose?: () => void;
}

export function SessionExpiredSheet({
  open,
  localMode = false,
  onSignIn,
  onClose,
}: SessionExpiredSheetProps) {
  const t = useTranslations("states.sessionExpired");
  const phase = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot,
  );
  // Asking someone with no network to sign in asks for what they cannot do.
  const dismissible = localMode;
  if (localMode && phase === "offline") return null;

  return (
    <Sheet
      open={open}
      onClose={dismissible && onClose ? onClose : onSignIn}
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
