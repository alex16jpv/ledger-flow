"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { ApiError, presentError } from "@/lib/api/errors";
import { FORGOT_PATH } from "@/lib/auth/routes";
import { Link } from "@/lib/i18n/navigation";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import type { SessionUser } from "@/lib/session/api";
import type { DeletedAccount } from "@/types/api";

import { carriedEmail, carryEmail } from "../carry";
import { retryAfterOf, useLogin } from "../hooks";
import { loginSchema, type LoginValues } from "../schemas";
import { PasswordInput } from "./PasswordInput";

interface LoginFormProps {
  onSuccess: (session: SessionUser) => void;
  onDeleted: (credentials: LoginValues, deleted: DeletedAccount) => void;
  forgotPasswordEnabled: boolean;
  knownEmail?: string | null;
}

export function LoginForm({
  onSuccess,
  onDeleted,
  forgotPasswordEnabled,
  knownEmail,
}: LoginFormProps) {
  const t = useTranslations();
  const login = useLogin();
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: carriedEmail(), password: "" },
  });
  const { errors } = form.formState;
  useEffect(() => {
    carryEmail("");
  }, []);
  useEffect(() => {
    if (!knownEmail || form.getValues("email") || form.getFieldState("email").isDirty) return;
    form.setValue("email", knownEmail);
    form.setFocus("password");
  }, [knownEmail, form]);

  const submit = form.handleSubmit(async (values) => {
    try {
      onSuccess(await login.mutateAsync(values));
    } catch (error) {
      if (error instanceof ApiError && error.code === "ACCOUNT_DELETED" && error.deletedAccount) {
        onDeleted(values, error.deletedAccount);
        return;
      }
      setRetryAfter(retryAfterOf(error));
    }
  });

  const failure = login.error;
  const invalidCredentials = failure instanceof ApiError && failure.status === 401;
  const deleted = failure instanceof ApiError && failure.code === "ACCOUNT_DELETED";
  const otherFailure =
    failure && !invalidCredentials && !deleted && retryAfter === null
      ? presentError(failure)
      : null;
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
      {forgotPasswordEnabled ? (
        <Link
          href={FORGOT_PATH}
          onClick={() => {
            carryEmail(form.getValues("email"));
          }}
          className="self-end text-sm font-medium text-brand-text"
        >
          {t("auth.login.forgotPassword")}
        </Link>
      ) : (
        <span
          className="self-end text-sm font-medium text-brand-text opacity-60"
          aria-disabled="true"
        >
          {t("auth.login.forgotPassword")}
          <span className="text-text-3">
            {" ("}
            {t("common.soon")}
            {")"}
          </span>
        </span>
      )}
      <Button type="submit" size="lg" block loading={login.isPending} disabled={blocked}>
        {t("auth.login.submit")}
      </Button>
    </form>
  );
}
