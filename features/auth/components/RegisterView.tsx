"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Skeleton } from "@/components/ui/Skeleton";
import { ONBOARDING_PATH } from "@/lib/auth/routes";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";

import type { PendingSignUp } from "../api";
import { useForgetPendingSignUp, usePendingSignUp } from "../hooks";
import { RegisterCodeForm } from "./RegisterCodeForm";
import { RegisterForm, type SignUpNotice, type TypedSignUp } from "./RegisterForm";

type Stage =
  | { kind: "form"; typed?: Partial<TypedSignUp>; notice?: SignUpNotice }
  | { kind: "code"; pending: PendingSignUp; typed: Partial<TypedSignUp> };

const bold = (chunks: React.ReactNode) => <b className="font-semibold text-text">{chunks}</b>;

export function RegisterView() {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const locale = useLocale();
  const remembered = usePendingSignUp();
  const forget = useForgetPendingSignUp();
  const [stage, setStage] = useState<Stage | null>(null);
  const current: Stage | null =
    stage ??
    (remembered.data
      ? { kind: "code", pending: remembered.data, typed: { email: remembered.data.email } }
      : remembered.isPending
        ? null
        : { kind: "form" });

  if (current === null) {
    return (
      <div className="flex flex-col gap-5" role="status" aria-busy="true">
        <AuthHeading title={t("title")} subtitle={t("subtitle")} />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (current.kind === "code") {
    return (
      <div className="flex flex-col gap-5">
        <AuthHeading
          title={t("code.title")}
          subtitle={t.rich("code.subtitle", { email: current.pending.email, b: bold })}
        />
        <RegisterCodeForm
          resendAfterSeconds={current.pending.resendAfterSeconds}
          onChangeEmail={() => {
            forget.mutate();
            setStage({ kind: "form", typed: current.typed });
          }}
          onExpired={() => {
            setStage({ kind: "form", typed: current.typed, notice: "expired" });
          }}
          onTaken={() => {
            setStage({ kind: "form", typed: current.typed, notice: "taken" });
          }}
          onDone={() => {
            router.replace(ONBOARDING_PATH);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <RegisterForm
        locale={isAppLocale(locale) ? locale : "en"}
        typed={current.typed}
        notice={current.notice}
        onSent={(pending, typed) => {
          setStage({ kind: "code", pending, typed });
        }}
      />
      <p className="text-center text-sm text-text-2">
        {t("alreadyHaveAccount")}{" "}
        <Link href="/login" className="font-medium text-brand-text">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
