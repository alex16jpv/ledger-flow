"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CodeField } from "@/components/ui/CodeField";
import { Field } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { ApiError } from "@/lib/api/errors";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { validationMessage } from "@/lib/i18n/validation";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionUser } from "@/lib/session/api";

import {
  type FailureKey,
  failureKey,
  retryAfterOf,
  useRequestResetCode,
  useResetPassword,
} from "../hooks";
import { resetCodeSchema, type ResetCodeValues } from "../schemas";
import { PasswordInput } from "./PasswordInput";
import { ResendBlock } from "./ResendBlock";

type Failure = "human" | FailureKey | null;

interface ResetCodeFormProps {
  email: string;
  resendAfterSeconds: number;
  onChangeEmail: () => void;
  onResent: (resendAfterSeconds: number) => void;
  onDone: (session: SessionUser) => void;
}

export function ResetCodeForm({
  email,
  resendAfterSeconds,
  onChangeEmail,
  onResent,
  onDone,
}: ResetCodeFormProps) {
  const t = useTranslations();
  const offline = useOffline();
  const check = useHumanCheck("forgot-password");
  const reset = useResetPassword();
  const resend = useRequestResetCode();
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [rejectedCode, setRejectedCode] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [saveRetryAfter, setSaveRetryAfter] = useState<number | null>(null);
  const [resendWait, setResendWait] = useState({ seconds: resendAfterSeconds, round: 0 });
  const form = useForm<ResetCodeValues>({
    resolver: zodResolver(resetCodeSchema),
    defaultValues: { code: "", newPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const code = useWatch({ control: form.control, name: "code" });
  const codeRejected = rejectedCode !== null && code === rejectedCode;

  useEffect(() => {
    if (!codeRejected) return;
    codeRef.current?.focus();
    codeRef.current?.select();
  }, [codeRejected]);

  const submit = form.handleSubmit(async ({ code: typed, newPassword }) => {
    setFailure(null);
    try {
      onDone(await reset.mutateAsync({ email, code: typed, newPassword }));
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setSaveRetryAfter(wait);
      else if (error instanceof ApiError && error.code === "RESET_CODE_INVALID")
        setRejectedCode(typed);
      else setFailure(failureKey(error));
    }
  });

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
      const { resendAfterSeconds: seconds } = await resend.mutateAsync({ email, captcha });
      setResendWait((current) => ({ seconds, round: current.round + 1 }));
      onResent(seconds);
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) {
        setResendWait((current) => ({ seconds: wait, round: current.round + 1 }));
        onResent(wait);
      } else {
        setFailure(
          error instanceof ApiError && error.code === "CAPTCHA_INVALID"
            ? "human"
            : failureKey(error),
        );
      }
    }
  };

  const busy = isSubmitting || resend.isPending;
  const codeError = codeRejected
    ? t("errors.RESET_CODE_INVALID")
    : validationMessage(t, errors.code?.message);

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {offline && (
        <Alert tone="warning" icon={WifiOff} title={t("auth.offline")}>
          {t("auth.reset.offline")}
        </Alert>
      )}
      {failure && failure !== "human" && <Alert tone="danger">{t(failure)}</Alert>}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <fieldset disabled={busy} className="contents">
        <div className="flex flex-col gap-3">
          <Field label={t("auth.reset.code")} error={codeError}>
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
                  onFilled={() => {
                    form.setFocus("newPassword");
                  }}
                />
              )}
            />
          </Field>
          <Field
            label={t("auth.reset.newPassword")}
            help={t("auth.register.passwordHelp")}
            error={validationMessage(t, errors.newPassword?.message)}
          >
            <PasswordInput
              autoComplete="new-password"
              placeholder={t("auth.register.passwordPlaceholder")}
              {...form.register("newPassword")}
            />
          </Field>
        </div>
      </fieldset>
      <p className="text-center text-xs text-text-3">{t("auth.reset.signsOut")}</p>
      {saveRetryAfter !== null && (
        <RateLimitAlert
          retryAfterSeconds={saveRetryAfter}
          onExpire={() => {
            setSaveRetryAfter(null);
          }}
        />
      )}
      <Button
        type="submit"
        size="lg"
        block
        loading={isSubmitting}
        disabled={offline || codeRejected || saveRetryAfter !== null || resend.isPending}
      >
        {t("auth.reset.submit")}
      </Button>
      <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
        {failure === "human" && <HumanCheckFailed className="mb-5" />}
        <ResendBlock
          key={resendWait.round}
          seconds={resendWait.seconds}
          sending={resend.isPending}
          disabled={offline || isSubmitting}
          onResend={() => {
            void sendAgain();
          }}
          onChangeEmail={onChangeEmail}
        />
      </HumanCheckSlot>
    </form>
  );
}
