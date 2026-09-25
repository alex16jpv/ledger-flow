"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonClasses, type ButtonStyleProps } from "@/components/ui/Button";
import { iconProps } from "@/lib/icons/sizes";
import { chromeIntentUrl } from "@/lib/pwa/platform";
import { useMounted } from "@/lib/react/useMounted";

// T-197: Samsung's WebAPK trips Android's dangerous-app block (SamsungInternet/support#123); Chrome's does not.
export function InstallWithChrome({ size, block }: Pick<ButtonStyleProps, "size" | "block">) {
  const t = useTranslations("settings.install.samsung");
  const href = useMounted() ? chromeIntentUrl(new URL(window.location.href)) : undefined;
  return (
    <a href={href} className={buttonClasses({ size, block })}>
      <ExternalLink {...iconProps("sm")} />
      {t("chrome")}
    </a>
  );
}

export function SamsungFallback({ onInstallHere }: { onInstallHere?: () => void }) {
  const t = useTranslations("settings.install.samsung");
  if (!onInstallHere) {
    return (
      <div className="flex flex-col gap-2 text-xs text-text-2">
        <p>{t("stepsLead")}</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-text">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
        </ol>
        <p>{t("warning")}</p>
      </div>
    );
  }
  return (
    <p className="text-xs text-text-2">
      {t.rich("fallback", {
        warning: t("warning"),
        here: (chunks) => (
          <button
            type="button"
            onClick={onInstallHere}
            className="font-medium text-brand-text underline underline-offset-2"
          >
            {chunks}
          </button>
        ),
      })}
    </p>
  );
}
