"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { validationMessage } from "@/lib/i18n/validation";
import { useOffline } from "@/lib/network/useOffline";
import type { User } from "@/types/api";

import { type ProfileChange, useUpdateProfile } from "../hooks";
import { profileSchema, type ProfileValues } from "../schemas";

export interface ProfileViewProps {
  user: User;
  onSaved: (reauthenticated: boolean) => void;
}

export function ProfileView({ user, onSaved }: ProfileViewProps) {
  const t = useTranslations();
  const update = useUpdateProfile();
  const offline = useOffline();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema(user.email)),
    defaultValues: { name: user.name, email: user.email, newPassword: "", currentPassword: "" },
  });
  const { errors } = form.formState;
  const [email, newPassword] = useWatch({ control: form.control, name: ["email", "newPassword"] });
  const credentialsChange =
    newPassword.length > 0 || email.trim().toLowerCase() !== user.email.toLowerCase();
  const serverFields = fieldErrors(update.error);
  const code = update.error instanceof ApiError ? update.error.code : null;
  const currentPasswordError =
    code === "CURRENT_PASSWORD_INVALID" ? t("errors.CURRENT_PASSWORD_INVALID") : undefined;
  const emailError = code === "DUPLICATE" ? t("errors.EMAIL_TAKEN") : undefined;
  const formError =
    update.error && !currentPasswordError && !emailError && Object.keys(serverFields).length === 0
      ? presentError(update.error)
      : null;

  const submit = form.handleSubmit(async (values) => {
    const change: ProfileChange = { name: values.name };
    if (values.email.trim().toLowerCase() !== user.email.toLowerCase()) change.email = values.email;
    if (values.newPassword) change.password = values.newPassword;
    if (change.email !== undefined || change.password !== undefined) {
      change.currentPassword = values.currentPassword;
      change.reauthenticateWith = {
        email: change.email ?? user.email,
        password: change.password ?? values.currentPassword,
      };
    }
    try {
      await update.mutateAsync(change);
      form.reset({ ...values, newPassword: "", currentPassword: "" });
      onSaved(change.reauthenticateWith !== undefined);
    } catch {
      return;
    }
  });

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
          label={t("settings.credentials.email")}
          help={t("settings.credentials.emailHelp")}
          error={emailError ?? validationMessage(t, errors.email?.message ?? serverFields.email)}
        >
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </Field>
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
        {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
        <Button type="submit" size="lg" block loading={update.isPending} disabled={offline}>
          {t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
