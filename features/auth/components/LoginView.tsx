"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { AuthHeading } from "@/components/shell/AuthFrame";
import { Alert } from "@/components/ui/Alert";
import { safeNextPath } from "@/lib/auth/routes";
import { isEnabled } from "@/lib/flags";
import { Link, useRouter } from "@/lib/i18n/navigation";

import { LoginForm } from "./LoginForm";

export function LoginView() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      {params.get("deleted") === "1" && <Alert tone="info">{t("deleted")}</Alert>}
      {/* P-32: the third exit lands here, and the account is untouched — say both things. */}
      {params.get("wiped") === "1" && <Alert tone="info">{t("wiped")}</Alert>}
      <LoginForm
        forgotPasswordEnabled={isEnabled("forgotPassword")}
        onSuccess={() => {
          router.replace(next);
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
