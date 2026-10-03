"use client";

import { Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { ApiError, presentError } from "@/lib/api/errors";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useWaitText } from "@/lib/hooks/useWaitText";
import { iconProps } from "@/lib/icons/sizes";
import { secondsUntilServer } from "@/lib/local/clock";
import { useOffline } from "@/lib/network/useOffline";
import { openConfirmNewEmail } from "@/lib/session/confirm-email";
import {
  changeNoLongerWaits,
  useCancelEmailChange,
  useResendEmailChange,
} from "@/lib/session/email-change";
import {
  type EmailFailure,
  emailFailure,
  RETRY_AFTER_FALLBACK_SECONDS,
} from "@/lib/session/email-failure";
import type { EmailChange } from "@/types/api";

const bold = (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>;

interface PendingEmailCardProps {
  emailChange: EmailChange;
  currentEmail: string;
}

export function PendingEmailCard({ emailChange, currentEmail }: PendingEmailCardProps) {
  const t = useTranslations();
  const toast = useToast();
  const offline = useOffline();
  const check = useHumanCheck("email-change");
  const resend = useResendEmailChange();
  const cancel = useCancelEmailChange();
  const [failure, setFailure] = useState<EmailFailure | null>(null);
  const [limited, setLimited] = useState<{ seconds: number; at: number } | null>(null);

  const nothingWaits = () => {
    toast.show({ message: t("errors.EMAIL_CHANGE_NOT_PENDING") });
  };

  const sendAgain = async () => {
    setFailure(null);
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setFailure("human");
      return;
    }
    try {
      await resend.mutateAsync(captcha);
      setLimited(null);
    } catch (error) {
      if (changeNoLongerWaits(error)) nothingWaits();
      else if (error instanceof ApiError && error.status === 429)
        setLimited({
          seconds: error.retryAfterSeconds ?? RETRY_AFTER_FALLBACK_SECONDS,
          at: Date.now(),
        });
      else setFailure(emailFailure(error));
    }
  };

  const drop = async () => {
    setFailure(null);
    try {
      await cancel.mutateAsync();
      toast.show({ message: t("settings.credentials.cancelled", { email: currentEmail }) });
    } catch (error) {
      setFailure(presentError(error).messageKey);
    }
  };

  const busy = resend.isPending || cancel.isPending;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4 shadow-1">
      <div className="flex items-start gap-3">
        <Tile size="sm" color="AMBER">
          <Mail {...iconProps("sm")} />
        </Tile>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-medium [overflow-wrap:anywhere]">
            {t.rich("settings.credentials.pendingTitle", { email: emailChange.email, b: bold })}
          </p>
          <p className="text-sm text-text-2">
            {t("settings.credentials.pendingBody", { email: currentEmail })}
          </p>
        </div>
      </div>
      {failure && failure !== "human" && <Alert tone="danger">{t(failure)}</Alert>}
      <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
        {failure === "human" && <HumanCheckFailed className="mb-3" />}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={offline || busy} onClick={openConfirmNewEmail}>
            {t("settings.credentials.enterCode")}
          </Button>
          <ResendButton
            key={`${emailChange.resendAvailableAt ?? "now"}:${limited?.at ?? 0}`}
            availableAt={emailChange.resendAvailableAt}
            limitedFor={limited?.seconds ?? null}
            sending={resend.isPending}
            disabled={offline || cancel.isPending}
            onResend={() => {
              void sendAgain();
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            loading={cancel.isPending}
            disabled={offline || resend.isPending}
            onClick={() => {
              void drop();
            }}
          >
            {t("settings.credentials.cancelChange")}
          </Button>
        </div>
      </HumanCheckSlot>
    </div>
  );
}

interface ResendButtonProps {
  availableAt: string | null;
  limitedFor: number | null;
  sending: boolean;
  disabled: boolean;
  onResend: () => void;
}

function ResendButton({ availableAt, limitedFor, sending, disabled, onResend }: ResendButtonProps) {
  const t = useTranslations("settings.credentials");
  const waitText = useWaitText();
  const [seconds] = useState(() => limitedFor ?? secondsUntilServer(availableAt));
  const remaining = useCountdown(seconds);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={sending}
      disabled={disabled || remaining > 0}
      onClick={onResend}
    >
      {remaining > 0 ? t("resendIn", { time: waitText(remaining) }) : t("resend")}
    </Button>
  );
}
