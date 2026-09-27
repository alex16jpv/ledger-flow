"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { ApiError } from "@/lib/api/errors";
import { FORGOT_PATH } from "@/lib/auth/routes";
import { Link } from "@/lib/i18n/navigation";
import { validationMessage } from "@/lib/i18n/validation";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";

import { keepLinkToken } from "../carry";
import {
  type FailureKey,
  failureKey,
  retryAfterOf,
  useFinishReset,
  useResetPassword,
} from "../hooks";
import { resetLinkSchema, type ResetLinkValues } from "../schemas";
import { useLinkToken } from "../useLinkToken";
import { PasswordInput } from "./PasswordInput";
import { RateLimitAlert } from "./RateLimitAlert";

export function ResetLinkView() {
  const t = useTranslations();
  const offline = useOffline();
  const finish = useFinishReset();
  const reset = useResetPassword();
  const token = useLinkToken("reset");
  const [dead, setDead] = useState(false);
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [redeemed, setRedeemed] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const form = useForm<ResetLinkValues>({
    resolver: zodResolver(resetLinkSchema),
    defaultValues: { newPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async ({ newPassword }) => {
    if (!token) return;
    setFailure(null);
    try {
      const session = await reset.mutateAsync({ token, newPassword });
      setRedeemed(true);
      keepLinkToken("reset", null);
      finish(session);
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setRetryAfter(wait);
      else if (
        error instanceof ApiError &&
        (error.code === "LINK_INVALID" || error.code === "VALIDATION")
      ) {
        keepLinkToken("reset", null);
        setDead(true);
      } else setFailure(failureKey(error));
    }
  });

  if (dead) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <Tile size="lg" color={null}>
            <CircleAlert {...iconProps("lg")} />
          </Tile>
          <AuthHeading title={t("auth.reset.deadTitle")} subtitle={t("auth.reset.deadBody")} />
        </div>
        <Link href={FORGOT_PATH} className={buttonClasses({ size: "lg", block: true })}>
          {t("auth.reset.askNewCode")}
        </Link>
        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-brand-text">
            {t("auth.forgot.backToSignIn")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("auth.reset.linkTitle")} />
      {token === undefined || redeemed ? (
        <Skeleton className="h-12 w-full" />
      ) : token === null ? (
        <Alert tone="warning">{t("auth.reset.linkLost")}</Alert>
      ) : (
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          noValidate
          className="flex flex-col gap-5"
        >
          {offline && (
            <Alert tone="warning" icon={WifiOff} title={t("auth.offline")}>
              {t("auth.reset.offline")}
            </Alert>
          )}
          {failure && <Alert tone="danger">{t(failure)}</Alert>}
          <fieldset disabled={isSubmitting} className="contents">
            <Field
              label={t("auth.reset.newPassword")}
              help={t("auth.register.passwordHelp")}
              error={validationMessage(t, errors.newPassword?.message)}
            >
              <PasswordInput
                autoComplete="new-password"
                placeholder={t("auth.register.passwordPlaceholder")}
                {...form.register("newPassword")}
              />
            </Field>
          </fieldset>
          <p className="text-center text-xs text-text-3">{t("auth.reset.signsOut")}</p>
          {retryAfter !== null && (
            <RateLimitAlert
              retryAfterSeconds={retryAfter}
              onExpire={() => {
                setRetryAfter(null);
              }}
            />
          )}
          <Button
            type="submit"
            size="lg"
            block
            loading={isSubmitting}
            disabled={offline || retryAfter !== null}
          >
            {t("auth.reset.submit")}
          </Button>
        </form>
      )}
      <p className="text-center text-sm text-text-2">
        {t.rich("auth.reset.linkFoot", {
          ask: (chunks) => (
            <Link href={FORGOT_PATH} className="font-medium text-brand-text">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
