"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { LanguageChoiceSheet, useDetectedLocale } from "@/components/shell/LanguageChoice";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { CurrencyPicker } from "@/components/ui/CurrencyPicker";
import { Field, Input } from "@/components/ui/Field";
import { Picker } from "@/components/ui/Picker";
import { Tile } from "@/components/ui/Tile";
import { TimeZonePicker } from "@/components/ui/TimeZonePicker";
import { ApiError, presentError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import { type AppLocale } from "@/lib/i18n/routing";
import { useDeviceDefaults } from "@/lib/i18n/useDeviceDefaults";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import type { SessionUser } from "@/lib/session/api";

import { retryAfterOf, useRegister } from "../hooks";
import { registerSchema, type RegisterValues } from "../schemas";
import { PasswordInput } from "./PasswordInput";
import { RateLimitAlert } from "./RateLimitAlert";

interface RegisterFormProps {
  locale: AppLocale;
  onSuccess: (session: SessionUser) => void;
}

export function RegisterForm({ locale, onSuccess }: RegisterFormProps) {
  const t = useTranslations();
  const registerMutation = useRegister();
  const defaults = useDeviceDefaults();
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const detected = useDetectedLocale();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      currency: "",
      timezone: "",
      consent: undefined,
    },
  });
  const { errors } = form.formState;
  const consent = useWatch({ control: form.control, name: "consent" });

  useEffect(() => {
    if (!defaults) return;
    if (!form.getValues("currency")) form.setValue("currency", defaults.currency);
    if (!form.getValues("timezone")) form.setValue("timezone", defaults.timeZone);
  }, [defaults, form]);

  const submit = form.handleSubmit(async ({ name, email, password, currency, timezone }) => {
    try {
      onSuccess(
        await registerMutation.mutateAsync({ name, email, password, currency, timezone, locale }),
      );
    } catch (error) {
      setRetryAfter(retryAfterOf(error));
    }
  });

  const failure = registerMutation.error;
  const emailTaken =
    failure instanceof ApiError &&
    (failure.code === "EMAIL_TAKEN" || failure.code === "DUPLICATE" || failure.status === 409);
  const serverError = failure instanceof ApiError && failure.status >= 500;
  const otherFailure =
    failure && !emailTaken && !serverError && retryAfter === null ? presentError(failure) : null;
  const blocked = retryAfter !== null;

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {serverError && <Alert tone="warning">{t("auth.register.maybeCreated")}</Alert>}
      {otherFailure && <Alert tone="danger">{t(otherFailure.messageKey)}</Alert>}
      {blocked && (
        <RateLimitAlert
          retryAfterSeconds={retryAfter}
          onExpire={() => {
            setRetryAfter(null);
            registerMutation.reset();
          }}
        />
      )}
      <div className="flex flex-col gap-3">
        <Field label={t("auth.register.name")} error={validationMessage(t, errors.name?.message)}>
          <Input
            autoComplete="name"
            leading={<User {...iconProps("sm")} />}
            {...form.register("name")}
          />
        </Field>
        <Field
          label={t("auth.email")}
          error={
            emailTaken ? (
              <>
                {t("auth.register.emailTaken")}{" "}
                <Link href="/login" className="font-medium underline">
                  {t("auth.register.signInLink")}
                </Link>
              </>
            ) : (
              validationMessage(t, errors.email?.message)
            )
          }
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            leading={<User {...iconProps("sm")} />}
            {...form.register("email")}
          />
        </Field>
        <Field
          label={t("auth.password")}
          help={t("auth.register.passwordHelp")}
          error={validationMessage(t, errors.password?.message)}
        >
          <PasswordInput
            autoComplete="new-password"
            placeholder={t("auth.register.passwordPlaceholder")}
            {...form.register("password")}
          />
        </Field>
        <Field label={t("auth.register.language")} help={t("auth.register.languageHelp")}>
          {/* The same value as the chip in the frame (F-02): both are the language the screen is
              being read in, and that is the `locale` the account is created with. */}
          <Picker
            label={
              detected === locale
                ? t("auth.register.languageDetected")
                : t("auth.register.language")
            }
            value={t(`settings.language.${locale}`)}
            onClick={() => {
              setLanguageOpen(true);
            }}
            leading={
              <Tile size="sm" color="BLUE">
                <Globe {...iconProps("sm")} />
              </Tile>
            }
          />
        </Field>
        <Field
          label={t("auth.register.currency")}
          help={t("auth.register.currencyHelp")}
          error={validationMessage(t, errors.currency?.message)}
        >
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <CurrencyPicker
                value={field.value || null}
                onChange={field.onChange}
                label={t("auth.register.currency")}
                hint={t("auth.register.currencyDetected")}
              />
            )}
          />
        </Field>
        <Field
          label={t("auth.register.timeZone")}
          error={validationMessage(t, errors.timezone?.message)}
        >
          <Controller
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <TimeZonePicker
                value={field.value || null}
                onChange={field.onChange}
                label={t("auth.register.timeZone")}
                hint={t("auth.register.timeZoneDetected")}
              />
            )}
          />
        </Field>
      </div>
      <Checkbox {...form.register("consent")} error={validationMessage(t, errors.consent?.message)}>
        {t.rich("auth.register.consent", {
          privacy: (chunks) => (
            <Link href="/privacy" className="font-medium text-brand-text" target="_blank">
              {chunks}
            </Link>
          ),
        })}
      </Checkbox>
      <Button
        type="submit"
        size="lg"
        block
        loading={registerMutation.isPending}
        disabled={blocked || !consent}
      >
        {t("auth.register.submit")}
      </Button>
      <LanguageChoiceSheet
        open={languageOpen}
        onClose={() => {
          setLanguageOpen(false);
        }}
      />
    </form>
  );
}
