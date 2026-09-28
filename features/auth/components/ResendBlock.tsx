"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useWaitText } from "@/lib/hooks/useWaitText";

interface ResendBlockProps {
  seconds: number;
  sending: boolean;
  disabled: boolean;
  onResend: () => void;
  onChangeEmail: () => void;
}

export function ResendBlock({
  seconds,
  sending,
  disabled,
  onResend,
  onChangeEmail,
}: ResendBlockProps) {
  const t = useTranslations("auth.reset");
  const waitText = useWaitText();
  const remaining = useCountdown(seconds);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      {remaining > 0 ? (
        <span className="py-1.5 text-sm text-text-3">
          {t("resendIn", { time: waitText(remaining) })}
        </span>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={sending}
          disabled={disabled}
          onClick={onResend}
        >
          {t("resend")}
        </Button>
      )}
      <span className="sr-only" aria-live="polite">
        {remaining === 0 ? t("resendReady") : ""}
      </span>
      <p className="text-xs text-text-3">
        {t.rich("notThere", {
          change: (chunks) => (
            <button type="button" onClick={onChangeEmail} className="font-medium text-brand-text">
              {chunks}
            </button>
          ),
        })}
      </p>
    </div>
  );
}
