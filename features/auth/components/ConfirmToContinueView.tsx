"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CloudUpload, User as UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError, fieldErrors, NetworkError } from "@/lib/api/errors";
import {
  APP_HOME_PATH,
  CONFIRM_TO_CONTINUE_PATH,
  LOGIN_PATH,
  REAUTH_PARAM,
} from "@/lib/auth/routes";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { useRouter } from "@/lib/i18n/navigation";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { secondsUntilServer } from "@/lib/local/clock";
import { countPendingOperations } from "@/lib/local/db";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionProfile } from "@/lib/session/api";
import { useRequestEmailChange } from "@/lib/session/email-change";
import { emailFailure, RETRY_AFTER_FALLBACK_SECONDS } from "@/lib/session/email-failure";
import { sessionKeys } from "@/lib/session/keys";

import { fetchSessionUser } from "../hooks";
import { changeEmailSchema, type ChangeEmailValues } from "../schemas";
import { ConfirmEmailForm, type Final, openingOf } from "./ConfirmEmailForm";
import { PasswordInput } from "./PasswordInput";

type Stage = "current" | "change" | "new";

interface ConfirmToContinueViewProps {
  onSignOut: (user: SessionProfile, pending: number) => void;
}

export function ConfirmToContinueView({ onSignOut }: ConfirmToContinueViewProps) {
  const t = useTranslations();
  const router = useRouter();
  const session = useQuery({
    queryKey: sessionKeys.me(),
    queryFn: fetchSessionUser,
    retry: false,
    staleTime: 0,
    networkMode: "always",
  });
  const user = session.data?.user;
  const unauthorized = session.error instanceof ApiError && session.error.status === 401;
  const offline = session.error instanceof NetworkError;

  useEffect(() => {
    if (unauthorized) {
      router.replace(`${LOGIN_PATH}?${REAUTH_PARAM}=1&next=${CONFIRM_TO_CONTINUE_PATH}`);
    } else if (offline || (user && !user.emailConfirmationRequired)) {
      router.replace(APP_HOME_PATH);
    }
  }, [unauthorized, offline, user, router]);

  if (session.isError && !unauthorized && !offline) {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading title={t("auth.confirmRequired.title")} />
        <Alert tone="danger">{t("auth.sendFailed")}</Alert>
        <Button size="lg" block onClick={() => void session.refetch()}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
  if (!user?.emailConfirmationRequired) {
    return (
      <div className="flex flex-col gap-5" role="status" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="mx-auto h-7 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  return <Door user={user} onSignOut={onSignOut} />;
}

function usePendingCount(userId: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let wanted = true;
    void countPendingOperations(userId)
      .then((value) => {
        if (wanted) setCount(value);
      })
      .catch(() => undefined);
    return () => {
      wanted = false;
    };
  }, [userId]);
  return count;
}

const bold = (chunks: React.ReactNode) => <b className="font-semibold">{chunks}</b>;

function Door({
  user,
  onSignOut,
}: {
  user: SessionProfile;
  onSignOut: ConfirmToContinueViewProps["onSignOut"];
}) {
  const t = useTranslations();
  const tc = useTranslations("states.confirmEmail");
  const router = useRouter();
  const pending = usePendingCount(user.id);
  const [stage, setStage] = useState<Stage>(user.emailChange ? "new" : "current");
  const [final, setFinal] = useState<Final | null>(null);
  const backIn = () => {
    router.replace(APP_HOME_PATH);
  };

  if (stage === "change") {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading
          title={t("auth.confirmRequired.changeTitle")}
          subtitle={t("auth.confirmRequired.changeSubtitle")}
        />
        <ChangeEmailForm
          onSent={() => {
            setFinal(null);
            setStage("new");
          }}
        />
        <button
          type="button"
          onClick={() => {
            setStage("current");
          }}
          className="self-center text-sm font-medium text-brand-text"
        >
          {t("auth.confirmRequired.back")}
        </button>
      </div>
    );
  }

  const change = user.emailChange;
  return (
    <div className="flex flex-col gap-5">
      <AuthHeading
        title={t("auth.confirmRequired.title")}
        subtitle={t("auth.confirmRequired.subtitle")}
      />
      {pending > 0 && (
        <Alert tone="info" icon={CloudUpload}>
          {t.rich("auth.confirmRequired.queued", { count: pending, b: bold })}
        </Alert>
      )}
      {final === "taken" && (
        <Alert tone="danger" title={tc("takenTitle")}>
          {tc("takenBody")}
        </Alert>
      )}
      {final === "gone" && (
        <Alert tone="warning" title={tc("goneTitle")}>
          {tc("goneBody")}
        </Alert>
      )}
      {stage === "new" && change ? (
        <ConfirmEmailForm
          key="new"
          target="new"
          email={change.email}
          centered
          opening={{
            shape: "code",
            resendAfterSeconds: secondsUntilServer(change.resendAvailableAt),
          }}
          onConfirmed={backIn}
          onChangeEmail={() => {
            setStage("change");
          }}
          onFinal={(ended) => {
            setFinal(ended);
            setStage("current");
          }}
        />
      ) : (
        <ConfirmEmailForm
          key="current"
          target="current"
          email={user.email}
          centered
          opening={openingOf(user)}
          onConfirmed={backIn}
          onChangeEmail={() => {
            setStage("change");
          }}
        />
      )}
      <button
        type="button"
        onClick={() => {
          onSignOut(user, pending);
        }}
        className="self-center text-sm font-medium text-brand-text"
      >
        {t("auth.confirmRequired.signOut")}
      </button>
    </div>
  );
}

function ChangeEmailForm({ onSent }: { onSent: () => void }) {
  const t = useTranslations();
  const tc = useTranslations("states.confirmEmail");
  const offline = useOffline();
  const request = useRequestEmailChange();
  const check = useHumanCheck("email-change");
  const [failure, setFailure] = useState<unknown>(null);
  const [humanRefused, setHumanRefused] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<ChangeEmailValues>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: "", currentPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ email, currentPassword }) => {
    setFailure(null);
    setHumanRefused(false);
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setHumanRefused(true);
      return;
    }
    try {
      await request.mutateAsync({ email: email.trim(), currentPassword, captcha });
      onSent();
    } catch (error) {
      if (error instanceof ApiError && error.status === 429)
        setRetryAfter(error.retryAfterSeconds ?? RETRY_AFTER_FALLBACK_SECONDS);
      else if (error instanceof ApiError && error.code === "CAPTCHA_INVALID") setHumanRefused(true);
      else setFailure(error);
    }
  });

  const code = failure instanceof ApiError ? failure.code : null;
  const shown = failure ? emailFailure(failure) : null;
  const serverFields = fieldErrors(failure);
  const passwordError =
    code === "CURRENT_PASSWORD_INVALID" ? t("errors.CURRENT_PASSWORD_INVALID") : undefined;
  const emailError = shown === "settings.credentials.emailUndeliverable" ? t(shown) : undefined;
  const formError =
    shown &&
    shown !== "human" &&
    !passwordError &&
    !emailError &&
    Object.keys(serverFields).length === 0
      ? shown
      : null;

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {offline && <Alert tone="warning">{t("settings.needsConnection")}</Alert>}
      {formError && <Alert tone="danger">{t(formError)}</Alert>}
      <div className="flex flex-col gap-3">
        <Field
          label={t("auth.confirmRequired.newEmail")}
          error={emailError ?? validationMessage(t, errors.email?.message ?? serverFields.email)}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            leading={<UserIcon {...iconProps("sm")} />}
            {...form.register("email")}
          />
        </Field>
        <Field
          label={t("settings.credentials.currentPassword")}
          help={t("auth.confirmRequired.currentPasswordHelp")}
          error={
            passwordError ??
            validationMessage(t, errors.currentPassword?.message ?? serverFields.currentPassword)
          }
        >
          <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
        </Field>
      </div>
      {retryAfter !== null && (
        <RateLimitAlert
          retryAfterSeconds={retryAfter}
          onExpire={() => {
            setRetryAfter(null);
          }}
        />
      )}
      <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
        {humanRefused && <HumanCheckFailed className="mb-5" />}
        <Button
          type="submit"
          size="lg"
          block
          loading={isSubmitting}
          disabled={offline || retryAfter !== null}
        >
          {tc("send")}
        </Button>
      </HumanCheckSlot>
    </form>
  );
}
