"use client";

import { Share } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { iconProps } from "@/lib/icons/sizes";
import { useInstallPrompt } from "@/lib/pwa/install";

// F-87: where the browser offers to install, this fires its prompt. Where it does not — iOS above
// all, which has no such event — it shows the steps of the browser in use, and never of another one.
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("settings.install.sheet");
  const install = useInstallPrompt();
  const offered = install.state === "available";
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 1;
  const steps = touch
    ? [t("iosStep1"), t("iosStep2"), t("iosStep3")]
    : [t("desktopStep1"), t("desktopStep2")];

  return (
    <Sheet open={open} onClose={onClose} title={t("title")}>
      <div className="flex flex-col gap-4">
        <Alert tone="info">{t("intro")}</Alert>
        <p className="text-sm text-text-2">{t("asked")}</p>
        {offered ? (
          <Button
            block
            size="lg"
            onClick={() => {
              void install.install().then(onClose);
            }}
          >
            {t("cta")}
          </Button>
        ) : (
          <>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              {steps.map((step, index) => (
                <li key={step}>
                  <span className="inline-flex items-center gap-1.5">
                    {step}
                    {index === 0 && touch ? <Share {...iconProps("sm")} /> : null}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-text-3">{t("fallback")}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
