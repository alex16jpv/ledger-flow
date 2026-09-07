"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ApiError, presentError } from "@/lib/api/errors";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import type { SessionUser } from "@/lib/session/api";

import { retryAfterOf, useLogin } from "../hooks";
import { loginSchema, type LoginValues } from "../schemas";
import { PasswordInput } from "./PasswordInput";
import { RateLimitAlert } from "./RateLimitAlert";

interface LoginFormProps {
  onSuccess: (session: SessionUser) => void;
  forgotPasswordEnabled: boolean;
}

export function LoginForm({ onSuccess, forgotPasswordEnabled }: LoginFormProps) {
  const t = useTranslations();
  const login = useLogin();
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    try {
      onSuccess(await login.mutateAsync(values));
    } catch (error) {
      setRetryAfter(retryAfterOf(error));
    }
  });

  const failure = login.error;
  const invalidCredentials = failure instanceof ApiError && failure.status === 401;
  const otherFailure =
    failure && !invalidCredentials && retryAfter === null ? presentError(failure) : null;
  const blocked = retryAfter !== null;

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {invalidCredentials && <Alert tone="danger">{t("auth.login.invalidCredentials")}</Alert>}
      {otherFailure && <Alert tone="danger">{t(otherFailure.messageKey)}</Alert>}
      {blocked && (
        <RateLimitAlert
          retryAfterSeconds={retryAfter}
          onExpire={() => {
            setRetryAfter(null);
            login.reset();
          }}
        />
      )}
      <div className="flex flex-col gap-3">
        <Field label={t("auth.email")} error={validationMessage(t, errors.email?.message)}>
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            leading={<User {...iconProps("sm")} />}
            {...form.register("email")}
          />
        </Field>
        <Field label={t("auth.password")} error={validationMessage(t, errors.password?.message)}>
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </Field>
      </div>
      <span
        className="self-end text-sm font-medium text-brand-text aria-disabled:opacity-60"
        aria-disabled={!forgotPasswordEnabled}
      >
        {t("auth.login.forgotPassword")}
        {!forgotPasswordEnabled && (
          <span className="text-text-3">
            {" ("}
            {t("common.soon")}
            {")"}
          </span>
        )}
      </span>
      <Button type="submit" size="lg" block loading={login.isPending} disabled={blocked}>
        {t("auth.login.submit")}
      </Button>
    </form>
  );
}
