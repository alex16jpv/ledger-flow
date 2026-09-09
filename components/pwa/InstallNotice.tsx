"use client";

import { MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tile } from "@/components/ui/Tile";
import { iconProps } from "@/lib/icons/sizes";
import { useInstallPrompt } from "@/lib/pwa/install";
import { installNoticeSilenced, snoozeInstallNotice } from "@/lib/pwa/install-notice";
import { displayMode } from "@/lib/pwa/mode";

import { InstallSheet } from "./InstallSheet";

// P-34 (owner, 2026-09-08): the user has to be told, and the browser cannot do it everywhere — iOS
// has no install event and no browser asks about durable storage at all. It is a card and not a
// modal: whoever came to log an expense did not come to hear about storage (DESIGN §8.18).
export function InstallNotice({ hasSomethingToLose }: { hasSomethingToLose: boolean }) {
  const t = useTranslations("home.installNotice");
  const install = useInstallPrompt();
  const [sheet, setSheet] = useState(false);
  const [silenced, setSilenced] = useState(() => installNoticeSilenced());

  if (
    silenced ||
    !hasSomethingToLose ||
    install.state === "installed" ||
    displayMode() === "installed"
  ) {
    return null;
  }

  return (
    <>
      <Card className="flex items-start gap-3">
        <Tile color="AMBER">
          <MonitorSmartphone {...iconProps("md")} />
        </Tile>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-md font-semibold">{t("title")}</span>
          <span className="text-sm text-text-2">{t("body")}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {install.state === "available" ? (
              <Button
                size="sm"
                onClick={() => {
                  void install.install();
                }}
              >
                {t("install")}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setSheet(true);
                }}
              >
                {t("how")}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                snoozeInstallNotice();
                setSilenced(true);
              }}
            >
              {t("dismiss")}
            </Button>
          </div>
        </div>
      </Card>
      <InstallSheet
        open={sheet}
        onClose={() => {
          setSheet(false);
        }}
      />
    </>
  );
}
