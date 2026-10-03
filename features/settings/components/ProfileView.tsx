"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { ApiError, fieldErrors } from "@/lib/api/errors";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { isEnabled } from "@/lib/flags";
import { useCalendarDay } from "@/lib/i18n/useCalendarDay";
import { validationMessage } from "@/lib/i18n/validation";
import { serverNow } from "@/lib/local/clock";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionProfile } from "@/lib/session/api";
import { emailUnconfirmed, openConfirmEmail } from "@/lib/session/confirm-email";
import { useRequestEmailChange } from "@/lib/session/email-change";
import { emailFailure, RETRY_AFTER_FALLBACK_SECONDS } from "@/lib/session/email-failure";

import { type ProfileChange, useUpdateProfile } from "../hooks";
import { profileSchema, type ProfileValues } from "../schemas";
import { PendingEmailCard } from "./PendingEmailCard";

interface ProfileSaved {
  reauthenticated: boolean;
  newEmail: string | null;
}

export interface ProfileViewProps {
  user: SessionProfile;
  onSaved: (saved: ProfileSaved) => void;
}

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function ProfileView({ user, onSaved }: ProfileViewProps) {
  const t = useTranslations();
  const calendarDay = useCalendarDay();
  const update = useUpdateProfile();
  const request = useRequestEmailChange();
  const offline = useOffline();
  const check = useHumanCheck("email-change");
  const [failure, setFailure] = useState<unknown>(null);
  const [humanRefused, setHumanRefused] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema(user.email)),
    defaultValues: { name: user.name, email: user.email, newPassword: "", currentPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const emailFlow = isEnabled("emailVerification");
  const unconfirmed = emailFlow && emailUnconfirmed(user);
  const [email, newPassword] = useWatch({ control: form.control, name: ["email", "newPassword"] });
  const newEmail = emailFlow && !sameEmail(email, user.email);
  const credentialsChange = newPassword.length > 0 || newEmail;
  const waiting =
    user.emailChange && Date.parse(user.emailChange.expiresAt) > serverNow()
      ? user.emailChange
      : null;
  const serverFields = fieldErrors(failure);
  const code = failure instanceof ApiError ? failure.code : null;
  const currentPasswordError =
    code === "CURRENT_PASSWORD_INVALID" ? t("errors.CURRENT_PASSWORD_INVALID") : undefined;
  const sent = failure ? emailFailure(failure) : null;
  const emailError = sent === "settings.credentials.emailUndeliverable" ? t(sent) : undefined;
  const formError =
    failure &&
    retryAfter === null &&
    sent !== "human" &&
    !currentPasswordError &&
    !emailError &&
    Object.keys(serverFields).length === 0
      ? sent
      : null;

  const askForNewEmail = async (values: ProfileValues): Promise<boolean> => {
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setHumanRefused(true);
      return false;
    }
    try {
      await request.mutateAsync({
        email: values.email.trim(),
        currentPassword: values.currentPassword,
        captcha,
      });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code === "CAPTCHA_INVALID") setHumanRefused(true);
      else fail(error);
      return false;
    }
  };

  const fail = (error: unknown) => {
    if (error instanceof ApiError && error.status === 429)
      setRetryAfter(error.retryAfterSeconds ?? RETRY_AFTER_FALLBACK_SECONDS);
    setFailure(error);
  };

  const submit = form.handleSubmit(async (values) => {
    setFailure(null);
    setHumanRefused(false);
    if (newEmail) {
      if (!(await askForNewEmail(values))) return;
      form.resetField("email");
    }
    const change: ProfileChange = {};
    if (values.name.trim() !== user.name) change.name = values.name;
    if (values.newPassword) {
      change.password = values.newPassword;
      change.currentPassword = values.currentPassword;
      change.reauthenticateWith = { email: user.email, password: values.newPassword };
    }
    if (!newEmail && change.name === undefined && change.password === undefined)
      change.name = values.name;
    try {
      if (change.name !== undefined || change.password !== undefined)
        await update.mutateAsync(change);
      form.reset({ ...values, email: user.email, newPassword: "", currentPassword: "" });
      onSaved({
        reauthenticated: change.reauthenticateWith !== undefined,
        newEmail: newEmail ? values.email.trim() : null,
      });
    } catch (error) {
      fail(error);
    }
  });

  const save = (
    <Button
      type="submit"
      size="lg"
      block
      loading={isSubmitting}
      disabled={offline || retryAfter !== null}
    >
      {t("common.saveChanges")}
    </Button>
  );

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("settings.credentials.name")}
          error={validationMessage(t, errors.name?.message ?? serverFields.name)}
        >
          <Input autoComplete="name" {...form.register("name")} />
        </Field>
        <Field
          label={
            unconfirmed ? (
              <span className="flex items-center gap-2">
                {t("settings.credentials.email")}
                <Badge tone="warning">{t("settings.credentials.notConfirmed")}</Badge>
              </span>
            ) : (
              t("settings.credentials.email")
            )
          }
          help={
            !emailFlow
              ? t("settings.credentials.emailLocked")
              : unconfirmed
                ? t.rich(
                    user.confirmBy
                      ? "settings.credentials.notConfirmedByHelp"
                      : "settings.credentials.notConfirmedHelp",
                    {
                      date: user.confirmBy ? calendarDay(user.confirmBy, false) : "",
                      confirm: (chunks) => (
                        <button
                          type="button"
                          onClick={openConfirmEmail}
                          className="font-medium text-brand-text"
                        >
                          {chunks}
                        </button>
                      ),
                    },
                  )
                : t("settings.credentials.emailHelp")
          }
          error={emailError ?? validationMessage(t, errors.email?.message ?? serverFields.email)}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            readOnly={!emailFlow}
            aria-readonly={!emailFlow}
            {...form.register("email")}
          />
        </Field>
        {emailFlow && waiting && (
          <PendingEmailCard emailChange={waiting} currentEmail={user.email} />
        )}
        <Field
          label={t("settings.credentials.newPassword")}
          optional
          help={t("settings.credentials.newPasswordHelp")}
          error={validationMessage(t, errors.newPassword?.message ?? serverFields.password)}
        >
          <Input type="password" autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        {credentialsChange && (
          <>
            <Alert tone="warning">{t("settings.credentials.reauthNote")}</Alert>
            <Field
              label={t("settings.credentials.currentPassword")}
              error={
                currentPasswordError ??
                validationMessage(
                  t,
                  errors.currentPassword?.message ?? serverFields.currentPassword,
                )
              }
            >
              <Input
                type="password"
                autoComplete="current-password"
                {...form.register("currentPassword")}
              />
            </Field>
          </>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {offline && <Alert tone="warning">{t("settings.needsConnection")}</Alert>}
        {formError && <Alert tone="danger">{t(formError)}</Alert>}
        {retryAfter !== null && (
          <RateLimitAlert
            retryAfterSeconds={retryAfter}
            onExpire={() => {
              setRetryAfter(null);
            }}
          />
        )}
        {newEmail ? (
          <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
            {humanRefused && <HumanCheckFailed className="mb-5" />}
            {save}
          </HumanCheckSlot>
        ) : (
          save
        )}
      </div>
    </form>
  );
}
