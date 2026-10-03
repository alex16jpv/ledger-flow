"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, Input } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { ApiError, presentError } from "@/lib/api/errors";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { isEnabled } from "@/lib/flags";
import { Link } from "@/lib/i18n/navigation";
import { type AppLocale } from "@/lib/i18n/routing";
import { useDeviceDefaults } from "@/lib/i18n/useDeviceDefaults";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";

import type { PendingSignUp, SignUpValues } from "../api";
import { retryAfterOf, useStartSignUp } from "../hooks";
import { registerSchema, type RegisterValues } from "../schemas";
import { PasswordInput } from "./PasswordInput";
import { ProfileDefaultsFields } from "./ProfileDefaultsFields";

const noSlot = () => undefined;

export type TypedSignUp = Omit<SignUpValues, "password" | "captcha" | "locale">;

export type SignUpNotice = "expired" | "taken";

interface RegisterFormProps {
  locale: AppLocale;
  typed?: Partial<TypedSignUp>;
  notice?: SignUpNotice;
  onSent: (pending: PendingSignUp, typed: TypedSignUp) => void;
}

export function RegisterForm({ locale, typed, notice, onSent }: RegisterFormProps) {
  const t = useTranslations();
  const registerMutation = useStartSignUp();
  const defaults = useDeviceDefaults();
  const canRegister = isEnabled("emailVerification");
  const check = useHumanCheck("register");
  const [humanFailed, setHumanFailed] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: typed?.name ?? "",
      email: typed?.email ?? "",
      password: "",
      currency: typed?.currency ?? "",
      timezone: typed?.timezone ?? "",
      consent: undefined,
    },
  });
  const { errors } = form.formState;
  const consent = useWatch({ control: form.control, name: "consent" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const timezone = useWatch({ control: form.control, name: "timezone" });

  useEffect(() => {
    if (!defaults) return;
    if (!form.getValues("currency")) form.setValue("currency", defaults.currency);
    if (!form.getValues("timezone")) form.setValue("timezone", defaults.timeZone);
  }, [defaults, form]);

  const submit = form.handleSubmit(async ({ name, email, password, currency, timezone }) => {
    if (!canRegister) return;
    setHumanFailed(false);
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setHumanFailed(true);
      return;
    }
    try {
      const pending = await registerMutation.mutateAsync({
        name,
        email,
        password,
        currency,
        timezone,
        locale,
        captcha,
      });
      onSent(pending, { name, email, currency, timezone });
    } catch (error) {
      if (error instanceof ApiError && error.code === "CAPTCHA_INVALID") setHumanFailed(true);
      setRetryAfter(retryAfterOf(error));
    }
  });

  const failure = registerMutation.error;
  const code = failure instanceof ApiError ? failure.code : null;
  const humanRefused = humanFailed || code === "CAPTCHA_INVALID";
  const serverError =
    failure instanceof ApiError && failure.status >= 500 && code !== "CAPTCHA_UNAVAILABLE";
  const otherFailure =
    failure && !serverError && !humanRefused && retryAfter === null ? presentError(failure) : null;
  const blocked = retryAfter !== null;

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {!canRegister && (
        <Alert tone="warning" title={t("auth.register.unavailable.title")}>
          {t("auth.register.unavailable.body")}
        </Alert>
      )}
      {notice === "expired" && !failure && (
        <Alert tone="warning" icon={Clock} title={t("auth.register.expired.title")}>
          {t("auth.register.expired.body")}
        </Alert>
      )}
      {notice === "taken" && !failure && (
        <Alert tone="warning" title={t("auth.register.taken.title")}>
          {t("auth.register.taken.body")}
        </Alert>
      )}
      {serverError && <Alert tone="danger">{t("auth.register.serverError")}</Alert>}
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
        <Field label={t("auth.email")} error={validationMessage(t, errors.email?.message)}>
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
        <ProfileDefaultsFields
          locale={locale}
          languageHelp
          currency={currency}
          onCurrencyChange={(code) => {
            form.setValue("currency", code, { shouldValidate: form.formState.isSubmitted });
          }}
          currencyError={validationMessage(t, errors.currency?.message)}
          timezone={timezone}
          onTimezoneChange={(zone) => {
            form.setValue("timezone", zone, { shouldValidate: form.formState.isSubmitted });
          }}
          timezoneError={validationMessage(t, errors.timezone?.message)}
        />
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
      <HumanCheckSlot interactive={check.interactive} mount={canRegister ? check.mount : noSlot}>
        {humanRefused && <HumanCheckFailed className="mb-5" />}
        <Button
          type="submit"
          size="lg"
          block
          loading={registerMutation.isPending || form.formState.isSubmitting}
          disabled={!canRegister || blocked || !consent}
        >
          {t("auth.register.submit")}
        </Button>
      </HumanCheckSlot>
    </form>
  );
}
