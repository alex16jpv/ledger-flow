"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { ApiError } from "@/lib/api/errors";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { Link } from "@/lib/i18n/navigation";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";

import { carryEmail } from "../carry";
import { type FailureKey, failureKey, retryAfterOf, useRequestResetCode } from "../hooks";
import { forgotSchema, type ForgotValues } from "../schemas";

type Failure = "human" | FailureKey | null;

interface ForgotRequestFormProps {
  defaultEmail: string;
  onSent: (email: string, resendAfterSeconds: number) => void;
}

export function ForgotRequestForm({ defaultEmail, onSent }: ForgotRequestFormProps) {
  const t = useTranslations();
  const offline = useOffline();
  const check = useHumanCheck("forgot-password");
  const request = useRequestResetCode();
  const [failure, setFailure] = useState<Failure>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: defaultEmail },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ email }) => {
    setFailure(null);
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setFailure("human");
      return;
    }
    try {
      const { resendAfterSeconds } = await request.mutateAsync({ email, captcha });
      onSent(email, resendAfterSeconds);
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setRetryAfter(wait);
      else
        setFailure(
          error instanceof ApiError && error.code === "CAPTCHA_INVALID"
            ? "human"
            : failureKey(error),
        );
    }
  });

  const blocked = offline || retryAfter !== null;

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
          {t("auth.forgot.offline")}
        </Alert>
      )}
      {retryAfter !== null && (
        <RateLimitAlert
          kind="requests"
          retryAfterSeconds={retryAfter}
          onExpire={() => {
            setRetryAfter(null);
          }}
        />
      )}
      {failure && failure !== "human" && <Alert tone="danger">{t(failure)}</Alert>}
      <fieldset disabled={isSubmitting} className="contents">
        <Field label={t("auth.email")} error={validationMessage(t, errors.email?.message)}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            leading={<User {...iconProps("sm")} />}
            {...form.register("email")}
          />
        </Field>
      </fieldset>
      <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
        {failure === "human" && <HumanCheckFailed className="mb-5" />}
        <Button type="submit" size="lg" block loading={isSubmitting} disabled={blocked}>
          {t("auth.forgot.submit")}
        </Button>
      </HumanCheckSlot>
      <p className="text-center text-sm">
        <Link
          href="/login"
          onClick={() => {
            carryEmail(form.getValues("email"));
          }}
          className="font-medium text-brand-text"
        >
          {t("auth.forgot.backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
