"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";

import { formatCountdown } from "./useCountdown";

const HOUR_SECONDS = 3600;

export function useWaitText(): (seconds: number) => string {
  const t = useTranslations("common");
  return useCallback(
    (seconds: number) =>
      seconds < HOUR_SECONDS
        ? formatCountdown(seconds)
        : t("hoursMinutes", {
            hours: Math.floor(seconds / HOUR_SECONDS),
            minutes: Math.floor((seconds % HOUR_SECONDS) / 60),
          }),
    [t],
  );
}
