"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { readSessionMarker } from "@/lib/auth/marker";
import { APP_HOME_PATH, nextAfterSignIn, safeNextPath } from "@/lib/auth/routes";
import { isEnabled } from "@/lib/flags";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { useCalendarDay } from "@/lib/i18n/useCalendarDay";
import type { DeletedAccount } from "@/types/api";

import { carryEmail } from "../carry";
import { pathAfterSignIn, useDeviceEmail } from "../hooks";
import type { LoginValues } from "../schemas";
import { LoginForm } from "./LoginForm";
import { RestoreAccountStep } from "./RestoreAccountStep";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

interface Restoring {
  credentials: LoginValues;
  deleted: DeletedAccount;
}

export function LoginView() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const params = useSearchParams();
  const calendarDay = useCalendarDay();
  const next = safeNextPath(params.get("next"));
  const knownEmail = useDeviceEmail();
  const [previous] = useState(() => readSessionMarker());
  const [restoring, setRestoring] = useState<Restoring | null>(null);
  const keptUntil = params.get("deleted");

  if (restoring) {
    return (
      <RestoreAccountStep
        credentials={restoring.credentials}
        deleted={restoring.deleted}
        onNotNow={() => {
          carryEmail(restoring.credentials.email);
          setRestoring(null);
        }}
        onRestored={({ user }) => {
          router.replace(pathAfterSignIn(user, `${APP_HOME_PATH}?restored=1`));
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      {keptUntil && DAY.test(keptUntil) && (
        <Alert tone="info" title={t("deletedTitle")}>
          {t("deleted", { date: calendarDay(keptUntil) })}
        </Alert>
      )}
      {/* P-32: the third exit lands here, and the account is untouched — say both things. */}
      {params.get("wiped") === "1" && <Alert tone="info">{t("wiped")}</Alert>}
      <LoginForm
        forgotPasswordEnabled={isEnabled("forgotPassword")}
        knownEmail={knownEmail}
        onSuccess={({ user }) => {
          router.replace(pathAfterSignIn(user, nextAfterSignIn(next, previous?.userId, user.id)));
        }}
        onDeleted={(credentials, deleted) => {
          setRestoring({ credentials, deleted });
        }}
      />
      <p className="text-center text-sm text-text-2">
        {t("newHere")}{" "}
        <Link
          href={{ pathname: "/register", query: params.get("next") ? { next } : undefined }}
          className="font-medium text-brand-text"
        >
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
