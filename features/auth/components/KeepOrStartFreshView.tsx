"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { User as UserIcon, WifiOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api/errors";
import { withFreshSession } from "@/lib/api/refresh";
import {
  APP_HOME_PATH,
  KEEP_OR_START_FRESH_PATH,
  LOGIN_PATH,
  ONBOARDING_PATH,
  REAUTH_PARAM,
} from "@/lib/auth/routes";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { type AppLocale, isAppLocale } from "@/lib/i18n/routing";
import { useDeviceDefaults } from "@/lib/i18n/useDeviceDefaults";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";
import { sessionKeys } from "@/lib/session/keys";
import type { KeepOrStartFreshInput, User } from "@/types/api";

import {
  dropThisCopy,
  type FailureKey,
  failureKey,
  fetchSessionUser,
  useKeepOrStartFresh,
} from "../hooks";
import { freshDetailsSchema, type FreshDetailsValues } from "../schemas";
import { ProfileDefaultsFields } from "./ProfileDefaultsFields";

type Step = "question" | "confirm" | "details";

const STEP_PARAM = "step";

function stepOf(value: string | null): Step {
  return value === "confirm" || value === "details" ? value : "question";
}

export function KeepOrStartFreshView() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useQuery({
    queryKey: sessionKeys.me(),
    queryFn: fetchSessionUser,
    retry: false,
    staleTime: 0,
  });
  const user = session.data?.user;
  const unauthorized = session.error instanceof ApiError && session.error.status === 401;

  useEffect(() => {
    if (unauthorized) {
      router.replace(`${LOGIN_PATH}?${REAUTH_PARAM}=1&next=${KEEP_OR_START_FRESH_PATH}`);
    } else if (user && !user.keepOrStartFresh) {
      router.replace(APP_HOME_PATH);
    }
  }, [unauthorized, user, router]);

  if (session.isError && !unauthorized)
    return <LoadFailed onRetry={() => void session.refetch()} />;
  if (!user?.keepOrStartFresh) return <Loading />;
  return <Question user={user} step={stepOf(params.get(STEP_PARAM))} />;
}

function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="mx-auto h-7 w-64" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("auth.keep.title")} />
      <Alert tone="danger">{t("auth.sendFailed")}</Alert>
      <Button size="lg" block onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

interface QuestionProps {
  user: User;
  step: Step;
}

function Question({ user, step }: QuestionProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const offline = useOffline();
  const answer = useKeepOrStartFresh(user.id);
  const [failure, setFailure] = useState<FailureKey | "inProgress" | null>(null);

  const send = async (choice: KeepOrStartFreshInput) => {
    setFailure(null);
    try {
      await withFreshSession(() => answer.mutateAsync(choice));
      router.replace(choice.choice === "keep" ? APP_HOME_PATH : ONBOARDING_PATH);
    } catch (error) {
      if (!(error instanceof ApiError)) setFailure(failureKey(error));
      else if (error.status === 401) {
        router.replace(`${LOGIN_PATH}?${REAUTH_PARAM}=1&next=${KEEP_OR_START_FRESH_PATH}`);
      } else if (error.code === "KEEP_OR_START_FRESH_CLOSED") {
        // A start-fresh whose answer was lost is answered CLOSED on its retry.
        if (choice.choice === "start-fresh") await dropThisCopy(user.id);
        router.replace(choice.choice === "keep" ? APP_HOME_PATH : ONBOARDING_PATH);
      } else if (error.code === "START_FRESH_IN_PROGRESS") setFailure("inProgress");
      else setFailure(failureKey(error));
    }
  };

  const goTo = (next: Step) => {
    router.push(next === "question" ? pathname : { pathname, query: { [STEP_PARAM]: next } });
  };

  const alerts = (
    <>
      {offline && (
        <Alert tone="warning" icon={WifiOff} title={t("auth.offline")}>
          {t("auth.keep.offline")}
        </Alert>
      )}
      {failure && failure !== "inProgress" && <Alert tone="danger">{t(failure)}</Alert>}
      {failure === "inProgress" && (
        <Alert tone="warning">{t("errors.START_FRESH_IN_PROGRESS")}</Alert>
      )}
    </>
  );

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading title={t("auth.keep.confirmTitle")} />
        <Alert tone="danger">
          {t.rich("auth.keep.confirmBody", {
            b: (chunks) => <b className="font-semibold">{chunks}</b>,
          })}
        </Alert>
        <div className="flex flex-col gap-2">
          <Button
            variant="dangerSolid"
            size="lg"
            block
            onClick={() => {
              goTo("details");
            }}
          >
            {t("auth.keep.confirm")}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            block
            onClick={() => {
              router.replace(pathname);
            }}
          >
            {t("auth.keep.goBack")}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "details") {
    return (
      <FreshDetailsForm
        alerts={alerts}
        blocked={offline}
        onSubmit={(details) => send({ choice: "start-fresh", ...details })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("auth.keep.title")} subtitle={t("auth.keep.subtitle")} />
      {alerts}
      <Facts facts={user.keepOrStartFresh} timeZone={user.timezone} />
      <p className="text-sm text-text-2">{t("auth.keep.help")}</p>
      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          block
          loading={answer.isPending}
          disabled={offline}
          onClick={() => {
            void send({ choice: "keep" });
          }}
        >
          {t("auth.keep.keep")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          block
          disabled={answer.isPending}
          onClick={() => {
            goTo("confirm");
          }}
        >
          {t("auth.keep.startFresh")}
        </Button>
      </div>
    </div>
  );
}

function Facts({ facts, timeZone }: { facts: User["keepOrStartFresh"]; timeZone: string }) {
  const t = useTranslations("auth.keep");
  const { formatLocale } = useFormatSettings();
  if (!facts) return null;
  const count = new Intl.NumberFormat(formatLocale);
  const rows = [
    [
      t("created"),
      new Intl.DateTimeFormat(formatLocale, { dateStyle: "medium", timeZone }).format(
        new Date(facts.createdAt),
      ),
    ],
    [t("accounts"), count.format(facts.accounts)],
    [t("transactions"), count.format(facts.transactions)],
  ] as const;
  return (
    <Card>
      <dl className="flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-text-2">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

interface FreshDetailsFormProps {
  alerts: ReactNode;
  blocked: boolean;
  onSubmit: (details: FreshDetailsValues & { locale: AppLocale }) => Promise<void>;
}

function FreshDetailsForm({ alerts, blocked, onSubmit }: FreshDetailsFormProps) {
  const t = useTranslations();
  const rawLocale = useLocale();
  const locale: AppLocale = isAppLocale(rawLocale) ? rawLocale : "en";
  const defaults = useDeviceDefaults();
  const form = useForm<FreshDetailsValues>({
    resolver: zodResolver(freshDetailsSchema),
    defaultValues: { name: "", currency: "", timezone: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const currency = useWatch({ control: form.control, name: "currency" });
  const timezone = useWatch({ control: form.control, name: "timezone" });

  useEffect(() => {
    if (!defaults) return;
    if (!form.getValues("currency")) form.setValue("currency", defaults.currency);
    if (!form.getValues("timezone")) form.setValue("timezone", defaults.timeZone);
  }, [defaults, form]);

  const submit = form.handleSubmit((values) => onSubmit({ ...values, locale }));

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <AuthHeading title={t("auth.keep.detailsTitle")} subtitle={t("auth.keep.detailsSubtitle")} />
      {alerts}
      <fieldset disabled={isSubmitting} className="contents">
        <div className="flex flex-col gap-3">
          <Field label={t("auth.register.name")} error={validationMessage(t, errors.name?.message)}>
            <Input
              autoComplete="name"
              placeholder={t("auth.keep.namePlaceholder")}
              leading={<UserIcon {...iconProps("sm")} />}
              {...form.register("name")}
            />
          </Field>
          <ProfileDefaultsFields
            locale={locale}
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
      </fieldset>
      <Button type="submit" size="lg" block loading={isSubmitting} disabled={blocked}>
        {t("common.continue")}
      </Button>
    </form>
  );
}
