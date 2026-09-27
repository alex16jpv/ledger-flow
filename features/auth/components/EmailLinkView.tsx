"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import {
  CircleAlert,
  type LucideIcon,
  MailCheck,
  TriangleAlert,
  UserX,
  WifiOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { ApiError } from "@/lib/api/errors";
import { APP_HOME_PATH, FORGOT_PATH, LOGIN_PATH, REGISTER_PATH } from "@/lib/auth/routes";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";
import type { ColorToken } from "@/lib/theme/feature-color";

import { keepLinkToken, type LinkPurpose } from "../carry";
import {
  type FailureKey,
  failureKey,
  retryAfterOf,
  useConfirmEmailLink,
  useDeleteAccountThatUsedMyEmail,
} from "../hooks";
import { useLinkToken } from "../useLinkToken";
import { RateLimitAlert } from "./RateLimitAlert";

type Stage = "ready" | "done" | "dead";

interface Outcome {
  icon: LucideIcon;
  color: ColorToken | null;
  title: string;
  body: string;
  action: { href: string; label: string };
}

interface EmailLinkPageProps {
  purpose: Exclude<LinkPurpose, "reset">;
  title: string;
  body: string;
  warning?: ReactNode;
  submit: { label: string; danger?: boolean };
  secondary?: { href: string; label: string };
  mutation: UseMutationResult<unknown, Error, string>;
  done: Outcome;
  dead: { body: string; action: { href: string; label: string } };
}

function OutcomeView({ icon: Icon, color, title, body, action }: Outcome) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <Tile size="lg" color={color}>
          <Icon {...iconProps("lg")} />
        </Tile>
        <AuthHeading title={title} subtitle={body} />
      </div>
      <Link href={action.href} className={buttonClasses({ size: "lg", block: true })}>
        {action.label}
      </Link>
    </div>
  );
}

function EmailLinkPage({
  purpose,
  title,
  body,
  warning,
  submit,
  secondary,
  mutation,
  done,
  dead,
}: EmailLinkPageProps) {
  const t = useTranslations();
  const offline = useOffline();
  const token = useLinkToken(purpose);
  const [stage, setStage] = useState<Stage>("ready");
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const tap = async () => {
    if (!token) return;
    setFailure(null);
    try {
      await mutation.mutateAsync(token);
      keepLinkToken(purpose, null);
      setStage("done");
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setRetryAfter(wait);
      else if (
        error instanceof ApiError &&
        (error.code === "LINK_INVALID" || error.code === "VALIDATION")
      ) {
        keepLinkToken(purpose, null);
        setStage("dead");
      } else setFailure(failureKey(error));
    }
  };

  if (stage === "done") return <OutcomeView {...done} />;
  if (stage === "dead") {
    return (
      <OutcomeView
        icon={CircleAlert}
        color={null}
        title={t("auth.reset.deadTitle")}
        body={dead.body}
        action={dead.action}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={title} subtitle={body} />
      {token === undefined ? (
        <Skeleton className="h-12 w-full" />
      ) : token === null ? (
        <Alert tone="warning">{t("auth.reset.linkLost")}</Alert>
      ) : (
        <>
          {warning}
          {offline && (
            <Alert tone="warning" icon={WifiOff} title={t("auth.offline")}>
              {t("auth.link.offline")}
            </Alert>
          )}
          {failure && <Alert tone="danger">{t(failure)}</Alert>}
          {retryAfter !== null && (
            <RateLimitAlert
              retryAfterSeconds={retryAfter}
              onExpire={() => {
                setRetryAfter(null);
              }}
            />
          )}
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              block
              variant={submit.danger ? "dangerSolid" : "primary"}
              loading={mutation.isPending}
              disabled={offline || retryAfter !== null}
              onClick={() => {
                void tap();
              }}
            >
              {submit.label}
            </Button>
            {secondary && (
              <Link
                href={secondary.href}
                className={buttonClasses({ variant: "ghost", size: "lg", block: true })}
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function VerifyLinkView() {
  const t = useTranslations("auth");
  const confirm = useConfirmEmailLink();
  const openApp = { href: APP_HOME_PATH, label: t("link.openApp") };
  return (
    <EmailLinkPage
      purpose="verify"
      title={t("verify.title")}
      body={t("verify.body")}
      submit={{ label: t("verify.submit") }}
      mutation={confirm}
      done={{
        icon: MailCheck,
        color: "GREEN",
        title: t("verify.doneTitle"),
        body: t("verify.doneBody"),
        action: openApp,
      }}
      dead={{ body: t("verify.deadBody"), action: openApp }}
    />
  );
}

export function NotMeLinkView() {
  const t = useTranslations("auth");
  const erase = useDeleteAccountThatUsedMyEmail();
  return (
    <EmailLinkPage
      purpose="not-me"
      title={t("notMe.title")}
      body={t("notMe.body")}
      warning={
        <Alert tone="warning" icon={TriangleAlert} title={t("notMe.warningTitle")}>
          {t("notMe.warningBody")}
        </Alert>
      }
      submit={{ label: t("notMe.submit"), danger: true }}
      secondary={{ href: LOGIN_PATH, label: t("notMe.keep") }}
      mutation={erase}
      done={{
        icon: UserX,
        color: null,
        title: t("notMe.doneTitle"),
        body: t("notMe.doneBody"),
        action: { href: REGISTER_PATH, label: t("notMe.createAccount") },
      }}
      dead={{ body: t("notMe.deadBody"), action: { href: FORGOT_PATH, label: t("notMe.forgot") } }}
    />
  );
}
