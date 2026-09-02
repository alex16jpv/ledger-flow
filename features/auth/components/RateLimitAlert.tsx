"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Alert } from "@/components/ui/Alert";
import { formatCountdown, useCountdown } from "@/lib/hooks/useCountdown";
import { iconProps } from "@/lib/icons/sizes";

interface RateLimitAlertProps {
  retryAfterSeconds: number;
  onExpire: () => void;
}

export function RateLimitAlert({ retryAfterSeconds, onExpire }: RateLimitAlertProps) {
  const t = useTranslations("auth.login");
  const remaining = useCountdown(retryAfterSeconds);

  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);

  return (
    <Alert tone="warning" title={t("tooManyAttempts")} aria-live="polite">
      <Clock {...iconProps("sm")} className="sr-only" />
      {t("retryIn", { time: formatCountdown(remaining) })}
    </Alert>
  );
}
