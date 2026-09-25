"use client";

import { Download, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { iconProps } from "@/lib/icons/sizes";
import { readStorageDurability } from "@/lib/local/persist";
import { useInstallPrompt } from "@/lib/pwa/install";
import { type InstallGuide, installGuide } from "@/lib/pwa/platform";
import { useMounted } from "@/lib/react/useMounted";

import { InstallWithChrome, SamsungFallback } from "./SamsungInstall";

type StepsGuide = Exclude<InstallGuide, "samsung">;

const STEPS = {
  "ios-safari": ["iosStep1", "iosStep2", "iosStep3"],
  "ios-other": ["iosOtherStep1", "iosStep2", "iosStep3"],
  android: ["androidStep1", "androidStep2"],
  "mac-safari": ["macStep1", "macStep2"],
  desktop: ["desktopStep1", "desktopStep2"],
} as const satisfies Record<StepsGuide, readonly string[]>;

const SHARE_FIRST: ReadonlySet<StepsGuide> = new Set(["ios-safari", "ios-other", "mac-safari"]);

// F-87: without the browser's install event it shows the steps of the browser in use, and no other's.
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("settings.install.sheet");
  const install = useInstallPrompt();
  const offered = install.state === "available";
  const guide = useMounted() ? installGuide() : "desktop";
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    let alive = true;
    void readStorageDurability().then((storage) => {
      if (alive) setRefused(storage.supported && !storage.persisted);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const installHere = () => {
    void install.install().then(onClose);
  };

  return (
    <Sheet layout="dialog" open={open} onClose={onClose} title={t("title")}>
      <div className="flex flex-col gap-4">
        <Alert tone="info">{t("intro")}</Alert>
        {refused ? <p className="text-sm text-text-2">{t("asked")}</p> : null}
        {guide === "samsung" ? (
          <>
            <p className="text-sm text-text-2">{t("samsungWhy")}</p>
            <InstallWithChrome size="lg" block />
            <SamsungFallback onInstallHere={offered ? installHere : undefined} />
          </>
        ) : offered ? (
          <Button block size="lg" onClick={installHere}>
            <Download {...iconProps("sm")} />
            {t("cta")}
          </Button>
        ) : (
          <>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              {STEPS[guide].map((step, index) => (
                <li key={step}>
                  <span className="inline-flex items-center gap-1.5">
                    {t(step)}
                    {index === 0 && SHARE_FIRST.has(guide) ? <Share {...iconProps("sm")} /> : null}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-text-3">
              {t(guide === "ios-other" ? "fallbackIosOther" : "fallback")}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}
