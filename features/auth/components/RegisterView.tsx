"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { ONBOARDING_PATH, safeNextPath } from "@/lib/auth/routes";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { isAppLocale } from "@/lib/i18n/routing";

import { AuthHeading } from "./AuthFrame";
import { RegisterForm } from "./RegisterForm";

export function RegisterView() {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const params = useSearchParams();
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <RegisterForm
        locale={isAppLocale(locale) ? locale : "en"}
        onSuccess={({ user }) => {
          if (user.reactivated) {
            router.replace(`${safeNextPath(params.get("next"))}?reactivated=1`);
            return;
          }
          router.replace(ONBOARDING_PATH);
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
