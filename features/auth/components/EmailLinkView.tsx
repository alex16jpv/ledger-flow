"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import {
  ArchiveRestore,
  CircleAlert,
  type LucideIcon,
  MailCheck,
  TriangleAlert,
  Undo2,
  WifiOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { RateLimitAlert } from "@/components/ui/RateLimitAlert";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tile } from "@/components/ui/Tile";
import { ApiError, type ErrorCode } from "@/lib/api/errors";
import { APP_HOME_PATH, FORGOT_PATH, LOGIN_PATH, REGISTER_PATH } from "@/lib/auth/routes";
import { Link } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";
import { useOffline } from "@/lib/network/useOffline";
import type { ColorToken } from "@/lib/theme/feature-color";

import { carryEmail, keepLinkToken, type LinkPurpose, rememberSentCode } from "../carry";
import {
  type FailureKey,
  failureKey,
  retryAfterOf,
  useConfirmEmailChangeLink,
  useConfirmEmailLink,
  useRestoreFromLink,
  useUndoFromLink,
} from "../hooks";
import { useLinkToken } from "../useLinkToken";

type Stage = "ready" | "done" | "dead" | "refused";

interface Way {
  href: string;
  label: string;
  onClick?: () => void;
}

interface Outcome {
  icon: LucideIcon;
  color: ColorToken | null;
  title: string;
  body: string;
  action: Way;
  secondary?: Way;
}

interface DeadLink {
  body: string;
  action: Way;
  secondary?: Way;
}

interface EmailLinkPageProps<T> {
  purpose: Exclude<LinkPurpose, "reset">;
  title: string;
  body: string;
  warning?: ReactNode;
  submit: { label: string };
  mutation: UseMutationResult<T, Error, string>;
  done: (answer: T) => Outcome;
  dead: (token: string) => DeadLink;
  refused?: { code: ErrorCode; outcome: Outcome };
}

function OutcomeView({ icon: Icon, color, title, body, action, secondary }: Outcome) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <Tile size="lg" color={color}>
          <Icon {...iconProps("lg")} />
        </Tile>
        <AuthHeading title={title} subtitle={body} />
      </div>
      <div className="flex flex-col gap-2">
        <Link
          href={action.href}
          onClick={action.onClick}
          className={buttonClasses({ size: "lg", block: true })}
        >
          {action.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            onClick={secondary.onClick}
            className={buttonClasses({ variant: "ghost", size: "lg", block: true })}
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function EmailLinkPage<T>({
  purpose,
  title,
  body,
  warning,
  submit,
  mutation,
  done,
  dead,
  refused,
}: EmailLinkPageProps<T>) {
  const t = useTranslations();
  const offline = useOffline();
  const token = useLinkToken(purpose);
  const [stage, setStage] = useState<Stage>("ready");
  const [answer, setAnswer] = useState<{ value: T } | null>(null);
  const [spent, setSpent] = useState("");
  const [failure, setFailure] = useState<FailureKey | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const tap = async () => {
    if (!token) return;
    setFailure(null);
    try {
      setAnswer({ value: await mutation.mutateAsync(token) });
      keepLinkToken(purpose, null);
      setStage("done");
    } catch (error) {
      const wait = retryAfterOf(error);
      if (wait !== null) setRetryAfter(wait);
      else if (refused && error instanceof ApiError && error.code === refused.code) {
        keepLinkToken(purpose, null);
        setStage("refused");
      } else if (
        error instanceof ApiError &&
        (error.code === "LINK_INVALID" || error.code === "VALIDATION")
      ) {
        keepLinkToken(purpose, null);
        setSpent(token);
        setStage("dead");
      } else setFailure(failureKey(error));
    }
  };

  if (stage === "done" && answer) return <OutcomeView {...done(answer.value)} />;
  if (stage === "refused" && refused) return <OutcomeView {...refused.outcome} />;
  if (stage === "dead") {
    return (
      <OutcomeView
        icon={CircleAlert}
        color={null}
        title={t("auth.reset.deadTitle")}
        {...dead(spent)}
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
          <Button
            size="lg"
            block
            loading={mutation.isPending}
            disabled={offline || retryAfter !== null}
            onClick={() => {
              void tap();
            }}
          >
            {submit.label}
          </Button>
        </>
      )}
    </div>
  );
}

// A deadline email's token is the account's id and 32 random bytes; sign-up and verify-email ones are shorter.
const DEADLINE_TOKEN_LENGTH = 64;

// The code went out with the answer, and asking for another before the address's minute would cancel it.
const RESEND_AFTER_LINK_SECONDS = 60;

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
      done={({ result }) =>
        result === "account-ready"
          ? {
              icon: MailCheck,
              color: "GREEN",
              title: t("verify.readyTitle"),
              body: t("verify.readyBody"),
              action: { href: LOGIN_PATH, label: t("verify.signIn") },
            }
          : {
              icon: MailCheck,
              color: "GREEN",
              title: t("verify.doneTitle"),
              body: t("verify.doneBody"),
              action: openApp,
            }
      }
      dead={(token) =>
        token.length === DEADLINE_TOKEN_LENGTH
          ? { body: t("verify.deadlineDeadBody"), action: openApp }
          : {
              body: t("verify.deadBody"),
              action: { href: REGISTER_PATH, label: t("verify.createAccount") },
              secondary: openApp,
            }
      }
    />
  );
}

export function ConfirmNewEmailLinkView() {
  const t = useTranslations("auth");
  const confirm = useConfirmEmailChangeLink();
  const openApp = { href: APP_HOME_PATH, label: t("link.openApp") };
  return (
    <EmailLinkPage
      purpose="confirm-email"
      title={t("confirmNewEmail.title")}
      body={t("confirmNewEmail.body")}
      submit={{ label: t("confirmNewEmail.submit") }}
      mutation={confirm}
      done={() => ({
        icon: MailCheck,
        color: "GREEN",
        title: t("confirmNewEmail.doneTitle"),
        body: t("confirmNewEmail.doneBody"),
        action: openApp,
      })}
      dead={() => ({ body: t("confirmNewEmail.deadBody"), action: openApp })}
      refused={{
        code: "EMAIL_TAKEN",
        outcome: {
          icon: CircleAlert,
          color: null,
          title: t("confirmNewEmail.takenTitle"),
          body: t("confirmNewEmail.takenBody"),
          action: openApp,
        },
      }}
    />
  );
}

interface PasswordStoppingLinkProps {
  purpose: "restore" | "undo";
  icon: LucideIcon;
  mutation: UseMutationResult<{ email: string; codeSent: boolean }, Error, string>;
}

function PasswordStoppingLink({ purpose, icon, mutation }: PasswordStoppingLinkProps) {
  const t = useTranslations("auth");
  const forgot = (email?: string) => ({
    href: FORGOT_PATH,
    label: t("login.forgotPassword"),
    onClick: () => {
      carryEmail(email ?? "");
    },
  });
  return (
    <EmailLinkPage
      purpose={purpose}
      title={t(`${purpose}.title`)}
      body={t(`${purpose}.body`)}
      warning={
        <Alert tone="warning" icon={TriangleAlert}>
          {t.rich("link.passwordStops", {
            b: (chunks) => <b className="font-semibold">{chunks}</b>,
          })}
        </Alert>
      }
      submit={{ label: t(`${purpose}.submit`) }}
      mutation={mutation}
      done={({ email, codeSent }) =>
        codeSent
          ? {
              icon,
              color: null,
              title: t(`${purpose}.doneTitle`),
              body: t("link.codeSent"),
              action: {
                href: FORGOT_PATH,
                label: t("link.enterCode"),
                onClick: () => {
                  rememberSentCode({
                    email,
                    resendAt: Date.now() + RESEND_AFTER_LINK_SECONDS * 1000,
                  });
                },
              },
            }
          : {
              icon,
              color: null,
              title: t(`${purpose}.doneTitle`),
              body: t("link.noCode"),
              action: forgot(email),
            }
      }
      dead={() => ({ body: t(`${purpose}.deadBody`), action: forgot() })}
    />
  );
}

export function RestoreLinkView() {
  return (
    <PasswordStoppingLink purpose="restore" icon={ArchiveRestore} mutation={useRestoreFromLink()} />
  );
}

export function UndoLinkView() {
  return <PasswordStoppingLink purpose="undo" icon={Undo2} mutation={useUndoFromLink()} />;
}
