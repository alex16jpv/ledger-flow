"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Alert } from "@/components/ui/Alert";
import { useCountdown } from "@/lib/hooks/useCountdown";

import { useWaitText } from "../hooks";

interface RateLimitAlertProps {
  retryAfterSeconds: number;
  onExpire: () => void;
  kind?: "attempts" | "requests";
}

export function RateLimitAlert({
  retryAfterSeconds,
  onExpire,
  kind = "attempts",
}: RateLimitAlertProps) {
  const t = useTranslations("auth");
  const waitText = useWaitText();
  const remaining = useCountdown(retryAfterSeconds);

  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);

  return (
    <Alert
      tone="warning"
      icon={Clock}
      title={kind === "attempts" ? t("login.tooManyAttempts") : t("forgot.tooManyRequests")}
      aria-live="polite"
    >
      {kind === "attempts"
        ? t("login.retryIn", { time: waitText(remaining) })
        : t("forgot.retryIn", { time: waitText(remaining) })}
    </Alert>
  );
}
