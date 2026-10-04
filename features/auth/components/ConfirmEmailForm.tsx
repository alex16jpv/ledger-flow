"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { CodeField } from "@/components/ui/CodeField";
import { Field } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { ApiError } from "@/lib/api/errors";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useWaitText } from "@/lib/hooks/useWaitText";
import { validationMessage } from "@/lib/i18n/validation";
import { secondsUntilServer } from "@/lib/local/clock";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionProfile } from "@/lib/session/api";
import type { ConfirmTarget } from "@/lib/session/confirm-email";
import { useConfirmEmailChangeCode, useResendEmailChange } from "@/lib/session/email-change";

import {
  type FailureKey,
  failureKey,
  retryAfterOf,
  useConfirmEmailCode,
  useSendVerificationCode,
} from "../hooks";
import { confirmCodeSchema, type ConfirmCodeValues } from "../schemas";
import { ResendBlock } from "./ResendBlock";

type Shape = "code" | "send";

type Failure = "human" | "sendFailed" | "expired" | FailureKey | null;

export type Final = "taken" | "gone";

export interface Opening {
  shape: Shape;
  resendAfterSeconds: number;
}

const bold = (chunks: React.ReactNode) => <b className="font-semibold text-text">{chunks}</b>;

const finalOf = (error: unknown): Final | null =>
  error instanceof ApiError && error.code === "EMAIL_TAKEN"
    ? "taken"
    : error instanceof ApiError && error.code === "EMAIL_CHANGE_NOT_PENDING"
      ? "gone"
      : null;

export function openingOf(user: SessionProfile): Opening {
  const verification = user.emailVerification;
  if (!verification) return { shape: "send", resendAfterSeconds: 0 };
  return {
    shape: verification.codeLive ? "code" : "send",
    resendAfterSeconds: secondsUntilServer(verification.resendAvailableAt),
  };
}

const secondsUntil = (at: number): number => Math.max(0, Math.ceil((at - Date.now()) / 1000));

function sendFailure(error: unknown): Failure {
  if (!(error instanceof ApiError)) return failureKey(error);
  if (error.code === "CAPTCHA_INVALID") return "human";
  if (error.code === "EMAIL_SEND_FAILED") return "sendFailed";
  return failureKey(error);
}

interface ConfirmEmailFormProps {
  target: ConfirmTarget;
  email: string;
  opening: Opening;
  centered?: boolean;
  onConfirmed: (email: string) => void;
  onChangeEmail: () => void;
  onFinal?: (final: Final) => void;
}

export function ConfirmEmailForm({
  target,
  email,
  opening,
  centered = false,
  onConfirmed,
  onChangeEmail,
  onFinal,
}: ConfirmEmailFormProps) {
  const t = useTranslations();
  const tc = useTranslations("states.confirmEmail");
  const offline = useOffline();
  const check = useHumanCheck(target === "new" ? "email-change" : "verify-email");
  const confirmCurrent = useConfirmEmailCode();
  const confirmNew = useConfirmEmailChangeCode();
  const sendCurrent = useSendVerificationCode();
  const sendNew = useResendEmailChange();
  const confirm = (code: string): Promise<unknown> =>
    target === "new" ? confirmNew.mutateAsync(code) : confirmCurrent.mutateAsync(code);
  const send = (captcha: string): Promise<{ resendAfterSeconds: number }> =>
    target === "new" ? sendNew.mutateAsync(captcha) : sendCurrent.mutateAsync(captcha);
  const sending = target === "new" ? sendNew.isPending : sendCurrent.isPending;
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [shape, setShape] = useState<Shape>(opening.shape);
  const [rejectedCode, setRejectedCode] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [confirmRetryAfter, setConfirmRetryAfter] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState(() => Date.now() + opening.resendAfterSeconds * 1000);
  const form = useForm<ConfirmCodeValues>({
    resolver: zodResolver(confirmCodeSchema),
    defaultValues: { code: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const code = useWatch({ control: form.control, name: "code" });
  const codeRejected = rejectedCode !== null && code === rejectedCode;

  useEffect(() => {
    if (!codeRejected) return;
    codeRef.current?.focus();
    codeRef.current?.select();
  }, [codeRejected]);

  const submit = form.handleSubmit(async ({ code: typed }) => {
    setFailure(null);
    try {
      await confirm(typed);
      onConfirmed(email);
    } catch (error) {
      const wait = retryAfterOf(error);
      const errorCode = error instanceof ApiError ? error.code : null;
      const ended = target === "new" ? finalOf(error) : null;
      if (ended) onFinal?.(ended);
      else if (wait !== null) setConfirmRetryAfter(wait);
      else if (errorCode === "EMAIL_CODE_INVALID") setRejectedCode(typed);
      else if (errorCode === "EMAIL_CODE_EXPIRED") {
        form.reset({ code: "" });
        setShape("send");
        setFailure("expired");
      } else setFailure(failureKey(error));
    }
  });

  const sendCode = async () => {
    setFailure(null);
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setFailure("human");
      return;
    }
    try {
      const { resendAfterSeconds } = await send(captcha);
      form.reset({ code: "" });
      setRejectedCode(null);
      setShape("code");
      setResendAt(Date.now() + resendAfterSeconds * 1000);
    } catch (error) {
      const wait = retryAfterOf(error);
      const ended = target === "new" ? finalOf(error) : null;
      if (ended) onFinal?.(ended);
      else if (error instanceof ApiError && error.code === "EMAIL_ALREADY_VERIFIED")
        onConfirmed(email);
      else if (wait !== null) setResendAt(Date.now() + wait * 1000);
      else setFailure(sendFailure(error));
    }
  };

  const busy = isSubmitting || sending;
  const alert = offline ? (
    <Alert tone="warning" icon={WifiOff} title={t("auth.offline")}>
      {tc("offline")}
    </Alert>
  ) : failure === "sendFailed" ? (
    <Alert tone="danger" title={tc("sendFailedTitle")}>
      {tc("sendFailedBody")}
    </Alert>
  ) : failure === "expired" ? (
    <Alert tone="warning">{t("errors.EMAIL_CODE_EXPIRED")}</Alert>
  ) : failure && failure !== "human" ? (
    <Alert tone="danger">{t(failure)}</Alert>
  ) : null;

  if (shape === "send") {
    return (
      <div className="flex flex-col gap-5">
        <p className={cn("text-sm text-text-2", centered && "text-center")}>
          {tc.rich("willSend", { email, b: bold })}
        </p>
        {alert}
        <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
          {failure === "human" && <HumanCheckFailed className="mb-5" />}
          <SendCodeButton
            key={resendAt}
            seconds={secondsUntil(resendAt)}
            sending={sending}
            disabled={offline}
            onSend={() => {
              void sendCode();
            }}
          />
        </HumanCheckSlot>
        <p className="text-center text-xs text-text-3">
          {tc.rich("wrongAddress", {
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

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <p className={cn("text-sm text-text-2", centered && "text-center")}>
        {tc.rich("sent", { email, b: bold })}
      </p>
      {alert}
      <fieldset disabled={busy || offline} className="contents">
        <Field
          label={t("auth.reset.code")}
          error={
            codeRejected
              ? t("errors.EMAIL_CODE_INVALID")
              : validationMessage(t, errors.code?.message)
          }
        >
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <CodeField
                ref={(element) => {
                  field.ref(element);
                  codeRef.current = element;
                }}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
      </fieldset>
      {confirmRetryAfter !== null && (
        <RateLimitAlert
          retryAfterSeconds={confirmRetryAfter}
          onExpire={() => {
            setConfirmRetryAfter(null);
          }}
        />
      )}
      <Button
        type="submit"
        size="lg"
        block
        loading={isSubmitting}
        disabled={offline || codeRejected || confirmRetryAfter !== null || sending}
      >
        {tc("submit")}
      </Button>
      <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
        {failure === "human" && <HumanCheckFailed className="mb-5" />}
        <ResendBlock
          key={resendAt}
          seconds={secondsUntil(resendAt)}
          sending={sending}
          disabled={offline || isSubmitting}
          onResend={() => {
            void sendCode();
          }}
          onChangeEmail={onChangeEmail}
        />
      </HumanCheckSlot>
    </form>
  );
}

interface SendCodeButtonProps {
  seconds: number;
  sending: boolean;
  disabled: boolean;
  onSend: () => void;
}

function SendCodeButton({ seconds, sending, disabled, onSend }: SendCodeButtonProps) {
  const t = useTranslations();
  const tc = useTranslations("states.confirmEmail");
  const waitText = useWaitText();
  const remaining = useCountdown(seconds);
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        block
        loading={sending}
        disabled={disabled || remaining > 0}
        onClick={onSend}
      >
        {tc("send")}
      </Button>
      {remaining > 0 && (
        <p className="text-center text-sm text-text-3">
          {t("auth.reset.resendIn", { time: waitText(remaining) })}
        </p>
      )}
    </div>
  );
}
