"use client";

import { Download, MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tile } from "@/components/ui/Tile";
import { iconProps } from "@/lib/icons/sizes";
import { readStorageDurability } from "@/lib/local/persist";
import { useInstallPrompt } from "@/lib/pwa/install";
import {
  installNoticeSilenced,
  NOTICE_POLICY,
  snoozeInstallNotice,
} from "@/lib/pwa/install-notice";
import { displayMode } from "@/lib/pwa/mode";
import { devicePlatform, installGuide } from "@/lib/pwa/platform";
import { useMounted } from "@/lib/react/useMounted";

import { InstallSheet } from "./InstallSheet";
import { InstallWithChrome, SamsungFallback } from "./SamsungInstall";

export function InstallNotice({ hasSomethingToLose }: { hasSomethingToLose: boolean }) {
  const t = useTranslations("home.installNotice");
  const install = useInstallPrompt();
  const mounted = useMounted();
  const [sheet, setSheet] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [durable, setDurable] = useState<boolean | null>(null);
  const policy = mounted ? NOTICE_POLICY[devicePlatform()] : null;
  const samsung = mounted && installGuide() === "samsung";
  const silenced = policy === null || snoozed || installNoticeSilenced(policy);

  useEffect(() => {
    let alive = true;
    void readStorageDurability().then((storage) => {
      if (alive) setDurable(storage.supported && storage.persisted);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (
    policy === null ||
    silenced ||
    durable === null ||
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
          {durable ? null : <span className="text-sm text-text-2">{t("risk")}</span>}
          <div className="mt-1 flex flex-wrap gap-2">
            {samsung ? (
              <InstallWithChrome size="sm" />
            ) : install.state === "available" ? (
              <Button
                size="sm"
                onClick={() => {
                  void install.install();
                }}
              >
                <Download {...iconProps("sm")} />
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
                snoozeInstallNotice(policy);
                setSnoozed(true);
              }}
            >
              {t("dismiss")}
            </Button>
          </div>
          {samsung ? (
            <SamsungFallback
              onInstallHere={() => {
                if (install.state === "available") void install.install();
                else setSheet(true);
              }}
            />
          ) : null}
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
