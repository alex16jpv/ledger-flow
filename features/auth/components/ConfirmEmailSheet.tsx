"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { CodeField } from "@/components/ui/CodeField";
import { Field } from "@/components/ui/Field";
import { HumanCheckFailed } from "@/components/ui/HumanCheckFailed";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api/errors";
import { PROFILE_PATH } from "@/lib/auth/routes";
import { HumanCheckSlot, useHumanCheck } from "@/lib/captcha/useHumanCheck";
import { useCountdown } from "@/lib/hooks/useCountdown";
import { useWaitText } from "@/lib/hooks/useWaitText";
import { useRouter } from "@/lib/i18n/navigation";
import { validationMessage } from "@/lib/i18n/validation";
import { secondsUntilServer } from "@/lib/local/clock";
import { useOffline } from "@/lib/network/useOffline";
import type { SessionProfile } from "@/lib/session/api";
import {
  closeConfirmEmail,
  type ConfirmTarget,
  emailUnconfirmed,
  useConfirmEmail,
} from "@/lib/session/confirm-email";
import { useConfirmEmailChangeCode, useResendEmailChange } from "@/lib/session/email-change";
import { useSession } from "@/lib/session/SessionProvider";

import {
  type FailureKey,
  failureKey,
  retryAfterOf,
  useConfirmEmailCode,
  useSendVerificationCode,
} from "../hooks";
import { confirmCodeSchema, type ConfirmCodeValues } from "../schemas";
import { ResendBlock } from "./ResendBlock";

type Shape = "code" | "send";

type Failure = "human" | "sendFailed" | "expired" | FailureKey | null;

type Final = "taken" | "gone";

interface Opening {
  shape: Shape;
  resendAfterSeconds: number;
}

const bold = (chunks: React.ReactNode) => <b className="font-semibold text-text">{chunks}</b>;

const finalOf = (error: unknown): Final | null =>
  error instanceof ApiError && error.code === "EMAIL_TAKEN"
    ? "taken"
    : error instanceof ApiError && error.code === "EMAIL_CHANGE_NOT_PENDING"
      ? "gone"
      : null;

function openingOf(user: SessionProfile): Opening {
  const verification = user.emailVerification;
  if (!verification) return { shape: "send", resendAfterSeconds: 0 };
  return {
    shape: verification.codeLive ? "code" : "send",
    resendAfterSeconds: secondsUntilServer(verification.resendAvailableAt),
  };
}

const secondsUntil = (at: number): number => Math.max(0, Math.ceil((at - Date.now()) / 1000));

function sendFailure(error: unknown): Failure {
  if (!(error instanceof ApiError)) return failureKey(error);
  if (error.code === "CAPTCHA_INVALID") return "human";
  if (error.code === "EMAIL_SEND_FAILED") return "sendFailed";
  return failureKey(error);
}

export function ConfirmEmailSheet() {
  const t = useTranslations("states.confirmEmail");
  const { sheetOpen, openings, target } = useConfirmEmail();
  return (
    <Sheet
      layout="dialog"
      open={sheetOpen}
      onClose={closeConfirmEmail}
      title={target === "new" ? t("newSheetTitle") : t("sheetTitle")}
    >
      {sheetOpen && <ConfirmEmailBody key={openings} target={target} />}
    </Sheet>
  );
}

function useConfirmed(target: ConfirmTarget): (email: string) => void {
  const t = useTranslations("states.confirmEmail");
  const toast = useToast();
  const said = useRef(false);
  return useCallback(
    (email: string) => {
      closeConfirmEmail();
      if (said.current) return;
      said.current = true;
      toast.show({ message: target === "new" ? t("newDone", { email }) : t("done") });
    },
    [t, toast, target],
  );
}

function NoLongerWaits({ final }: { final: Final }) {
  const t = useTranslations("states.confirmEmail");
  return final === "taken" ? (
    <Alert tone="danger" title={t("takenTitle")}>
      {t("takenBody")}
    </Alert>
  ) : (
    <Alert tone="warning" title={t("goneTitle")}>
      {t("goneBody")}
    </Alert>
  );
}

function ConfirmEmailBody({ target }: { target: ConfirmTarget }) {
  const t = useTranslations();
  const session = useSession();
  const offline = useOffline();
  const confirmed = useConfirmed(target);
  const [answer, setAnswer] = useState<{ user: SessionProfile | null } | null>(null);
  const asked = answer !== null;
  const [final, setFinal] = useState<Final | null>(null);
  const refetch = useRef(session.refetch);

  useEffect(() => {
    let wanted = true;
    void refetch.current().then(
      (result) => {
        if (wanted) setAnswer({ user: result.data?.user ?? null });
      },
      () => {
        if (wanted) setAnswer({ user: null });
      },
    );
    return () => {
      wanted = false;
    };
  }, []);

  // What `/me` answered when the sheet opened: the cache can lag it, and later writes must not remount.
  const user = answer?.user ?? session.user;
  const confirmedEmail =
    target === "current" && asked && user !== null && !emailUnconfirmed(user) ? user.email : null;
  const alreadyConfirmed = confirmedEmail !== null;
  useEffect(() => {
    if (confirmedEmail !== null) confirmed(confirmedEmail);
  }, [confirmedEmail, confirmed]);

  if (!user || alreadyConfirmed || (!asked && !offline)) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  const formKey = asked ? "asked" : "cached";
  if (final) return <NoLongerWaits final={final} />;
  if (target === "new") {
    if (!user.emailChange) return <NoLongerWaits final="gone" />;
    return (
      <ConfirmEmailForm
        key={formKey}
        target="new"
        email={user.emailChange.email}
        opening={{
          shape: "code",
          resendAfterSeconds: secondsUntilServer(user.emailChange.resendAvailableAt),
        }}
        onConfirmed={confirmed}
        onFinal={setFinal}
      />
    );
  }
  return (
    <ConfirmEmailForm
      key={formKey}
      target="current"
      email={user.email}
      opening={openingOf(user)}
      onConfirmed={confirmed}
    />
  );
}

interface ConfirmEmailFormProps {
  target: ConfirmTarget;
  email: string;
  opening: Opening;
  onConfirmed: (email: string) => void;
  onFinal?: (final: Final) => void;
}

function ConfirmEmailForm({ target, email, opening, onConfirmed, onFinal }: ConfirmEmailFormProps) {
  const t = useTranslations();
  const router = useRouter();
  const offline = useOffline();
  const check = useHumanCheck(target === "new" ? "email-change" : "verify-email");
  const confirmCurrent = useConfirmEmailCode();
  const confirmNew = useConfirmEmailChangeCode();
  const sendCurrent = useSendVerificationCode();
  const sendNew = useResendEmailChange();
  const confirm = (code: string): Promise<unknown> =>
    target === "new" ? confirmNew.mutateAsync(code) : confirmCurrent.mutateAsync(code);
  const send = (captcha: string): Promise<{ resendAfterSeconds: number }> =>
    target === "new" ? sendNew.mutateAsync(captcha) : sendCurrent.mutateAsync(captcha);
  const sending = target === "new" ? sendNew.isPending : sendCurrent.isPending;
  const codeRef = useRef<HTMLInputElement | null>(null);
  const [shape, setShape] = useState<Shape>(opening.shape);
  const [rejectedCode, setRejectedCode] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [confirmRetryAfter, setConfirmRetryAfter] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState(() => Date.now() + opening.resendAfterSeconds * 1000);
  const form = useForm<ConfirmCodeValues>({
    resolver: zodResolver(confirmCodeSchema),
    defaultValues: { code: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const code = useWatch({ control: form.control, name: "code" });
  const codeRejected = rejectedCode !== null && code === rejectedCode;

  useEffect(() => {
    if (!codeRejected) return;
    codeRef.current?.focus();
    codeRef.current?.select();
  }, [codeRejected]);

  const changeEmail = () => {
    closeConfirmEmail();
    router.push(PROFILE_PATH);
  };

  const submit = form.handleSubmit(async ({ code: typed }) => {
    setFailure(null);
    try {
      await confirm(typed);
      onConfirmed(email);
    } catch (error) {
      const wait = retryAfterOf(error);
      const errorCode = error instanceof ApiError ? error.code : null;
      const ended = target === "new" ? finalOf(error) : null;
      if (ended) onFinal?.(ended);
      else if (wait !== null) setConfirmRetryAfter(wait);
      else if (errorCode === "EMAIL_CODE_INVALID") setRejectedCode(typed);
      else if (errorCode === "EMAIL_CODE_EXPIRED") {
        form.reset({ code: "" });
        setShape("send");
        setFailure("expired");
      } else setFailure(failureKey(error));
    }
  });

  const sendCode = async () => {
    setFailure(null);
    let captcha: string;
    try {
      captcha = await check.token();
    } catch {
      setFailure("human");
      return;
    }
    try {
      const { resendAfterSeconds } = await send(captcha);
      form.reset({ code: "" });
      setRejectedCode(null);
      setShape("code");
      setResendAt(Date.now() + resendAfterSeconds * 1000);
    } catch (error) {
      const wait = retryAfterOf(error);
      const ended = target === "new" ? finalOf(error) : null;
      if (ended) onFinal?.(ended);
      else if (error instanceof ApiError && error.code === "EMAIL_ALREADY_VERIFIED")
        onConfirmed(email);
      else if (wait !== null) setResendAt(Date.now() + wait * 1000);
      else setFailure(sendFailure(error));
    }
  };

  const busy = isSubmitting || sending;
  const alert = offline ? (
    <Alert tone="warning" icon={WifiOff} title={t("auth.offline")}>
      {t("states.confirmEmail.offline")}
    </Alert>
  ) : failure === "sendFailed" ? (
    <Alert tone="danger" title={t("states.confirmEmail.sendFailedTitle")}>
      {t("states.confirmEmail.sendFailedBody")}
    </Alert>
  ) : failure === "expired" ? (
    <Alert tone="warning">{t("errors.EMAIL_CODE_EXPIRED")}</Alert>
  ) : failure && failure !== "human" ? (
    <Alert tone="danger">{t(failure)}</Alert>
  ) : null;

  if (shape === "send") {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-2">
          {t.rich("states.confirmEmail.willSend", { email, b: bold })}
        </p>
        {alert}
        <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
          {failure === "human" && <HumanCheckFailed className="mb-5" />}
          <SendCodeButton
            key={resendAt}
            seconds={secondsUntil(resendAt)}
            sending={sending}
            disabled={offline}
            onSend={() => {
              void sendCode();
            }}
          />
        </HumanCheckSlot>
        <p className="text-center text-xs text-text-3">
          {t.rich("states.confirmEmail.wrongAddress", {
            change: (chunks) => (
              <button type="button" onClick={changeEmail} className="font-medium text-brand-text">
                {chunks}
              </button>
            ),
          })}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <p className="text-sm text-text-2">
        {t.rich("states.confirmEmail.sent", { email, b: bold })}
      </p>
      {alert}
      <fieldset disabled={busy || offline} className="contents">
        <Field
          label={t("auth.reset.code")}
          error={
            codeRejected
              ? t("errors.EMAIL_CODE_INVALID")
              : validationMessage(t, errors.code?.message)
          }
        >
          <Controller
            control={form.control}
            name="code"
            render={({ field }) => (
              <CodeField
                ref={(element) => {
                  field.ref(element);
                  codeRef.current = element;
                }}
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
        </Field>
      </fieldset>
      {confirmRetryAfter !== null && (
        <RateLimitAlert
          retryAfterSeconds={confirmRetryAfter}
          onExpire={() => {
            setConfirmRetryAfter(null);
          }}
        />
      )}
      <Button
        type="submit"
        size="lg"
        block
        loading={isSubmitting}
        disabled={offline || codeRejected || confirmRetryAfter !== null || sending}
      >
        {t("states.confirmEmail.submit")}
      </Button>
      <HumanCheckSlot interactive={check.interactive} mount={check.mount}>
        {failure === "human" && <HumanCheckFailed className="mb-5" />}
        <ResendBlock
          key={resendAt}
          seconds={secondsUntil(resendAt)}
          sending={sending}
          disabled={offline || isSubmitting}
          onResend={() => {
            void sendCode();
          }}
          onChangeEmail={changeEmail}
        />
      </HumanCheckSlot>
    </form>
  );
}

interface SendCodeButtonProps {
  seconds: number;
  sending: boolean;
  disabled: boolean;
  onSend: () => void;
}

function SendCodeButton({ seconds, sending, disabled, onSend }: SendCodeButtonProps) {
  const t = useTranslations();
  const waitText = useWaitText();
  const remaining = useCountdown(seconds);
  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        block
        loading={sending}
        disabled={disabled || remaining > 0}
        onClick={onSend}
      >
        {t("states.confirmEmail.send")}
      </Button>
      {remaining > 0 && (
        <p className="text-center text-sm text-text-3">
          {t("auth.reset.resendIn", { time: waitText(remaining) })}
        </p>
      )}
    </div>
  );
}
