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
  useConfirmSignUp,
  useResendSignUpCode,
} from "../hooks";
import { confirmCodeSchema, type ConfirmCodeValues } from "../schemas";
import { ResendBlock } from "./ResendBlock";

type Failure = "human" | FailureKey | null;

interface RegisterCodeFormProps {
  resendAfterSeconds: number;
  onChangeEmail: () => void;
  onExpired: () => void;
  onTaken: () => void;
  onDone: (session: SessionUser) => void;
}

export function RegisterCodeForm({
  resendAfterSeconds,
  onChangeEmail,
  onExpired,
  onTaken,
  onDone,
}: RegisterCodeFormProps) {
  const t = useTranslations();
  const offline = useOffline();
  const check = useHumanCheck("register");
  const confirm = useConfirmSignUp();
  const resend = useResendSignUpCode();
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [rejectedCode, setRejectedCode] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [confirmRetryAfter, setConfirmRetryAfter] = useState<number | null>(null);
  const [resendWait, setResendWait] = useState({ seconds: resendAfterSeconds, round: 0 });
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
      onDone(await confirm.mutateAsync(typed));
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setConfirmRetryAfter(wait);
      else if (error instanceof ApiError && error.code === "SIGN_UP_CODE_INVALID")
        setRejectedCode(typed);
      else if (error instanceof ApiError && error.code === "EMAIL_TAKEN") onTaken();
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
      const { resendAfterSeconds: seconds } = await resend.mutateAsync(captcha);
      setResendWait((current) => ({ seconds, round: current.round + 1 }));
    } catch (error) {
      const wait = retryAfterOf(error);
      if (error instanceof ApiError && error.code === "SIGN_UP_EXPIRED") onExpired();
      else if (wait !== null)
        setResendWait((current) => ({ seconds: wait, round: current.round + 1 }));
      else
        setFailure(
          error instanceof ApiError && error.code === "CAPTCHA_INVALID"
            ? "human"
            : failureKey(error),
        );
    }
  };

  const busy = isSubmitting || resend.isPending;

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
          {t("auth.register.offline")}
        </Alert>
      )}
      {failure && failure !== "human" && <Alert tone="danger">{t(failure)}</Alert>}
      <fieldset disabled={busy} className="contents">
        <Field
          label={t("auth.reset.code")}
          error={
            codeRejected
              ? t("errors.SIGN_UP_CODE_INVALID")
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
        disabled={offline || codeRejected || confirmRetryAfter !== null || resend.isPending}
      >
        {t("auth.register.submit")}
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
