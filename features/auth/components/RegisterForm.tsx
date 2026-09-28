"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { User } from "lucide-react";
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
import { FORGOT_PATH, LOGIN_PATH } from "@/lib/auth/routes";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { isEnabled } from "@/lib/flags";
import { Link } from "@/lib/i18n/navigation";
import { type AppLocale } from "@/lib/i18n/routing";
import { useDeviceDefaults } from "@/lib/i18n/useDeviceDefaults";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import type { SessionUser } from "@/lib/session/api";

import { carryEmail } from "../carry";
import { retryAfterOf, useRegister } from "../hooks";
import { registerSchema, type RegisterValues } from "../schemas";
import { PasswordInput } from "./PasswordInput";
import { ProfileDefaultsFields } from "./ProfileDefaultsFields";

const noSlot = () => undefined;

interface RegisterFormProps {
  locale: AppLocale;
  onSuccess: (session: SessionUser) => void;
}

export function RegisterForm({ locale, onSuccess }: RegisterFormProps) {
  const t = useTranslations();
  const registerMutation = useRegister();
  const defaults = useDeviceDefaults();
  const canRegister = isEnabled("emailVerification");
  const check = useHumanCheck("register");
  const [humanFailed, setHumanFailed] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
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
      onSuccess(
        await registerMutation.mutateAsync({
          name,
          email,
          password,
          currency,
          timezone,
          locale,
          captcha,
        }),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "CAPTCHA_INVALID") setHumanFailed(true);
      setRetryAfter(retryAfterOf(error));
    }
  });

  const carryTyped = () => {
    carryEmail(form.getValues("email"));
  };

  const failure = registerMutation.error;
  const code = failure instanceof ApiError ? failure.code : null;
  const emailTaken = code === "EMAIL_TAKEN";
  const humanRefused = humanFailed || code === "CAPTCHA_INVALID";
  const nothingCreated = code === "CAPTCHA_UNAVAILABLE";
  const serverError = failure instanceof ApiError && failure.status >= 500 && !nothingCreated;
  const otherFailure =
    failure && !emailTaken && !serverError && !humanRefused && retryAfter === null
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
      {!canRegister && (
        <Alert tone="warning" title={t("auth.register.unavailable.title")}>
          {t("auth.register.unavailable.body")}
        </Alert>
      )}
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
              <span>
                {t.rich("auth.register.emailTaken", {
                  signIn: (chunks) => (
                    <Link href={LOGIN_PATH} onClick={carryTyped} className="font-medium underline">
                      {chunks}
                    </Link>
                  ),
                  reset: (chunks) => (
                    <Link href={FORGOT_PATH} onClick={carryTyped} className="font-medium underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
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
