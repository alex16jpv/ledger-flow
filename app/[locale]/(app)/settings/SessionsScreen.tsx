"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/shell/PageHeader";
import { SessionsView } from "@/features/settings/components/SessionsView";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { useRouter } from "@/lib/i18n/navigation";
import { useBackNavigation } from "@/lib/navigation/history";
import { useSession } from "@/lib/session";

export function SessionsScreen() {
  const t = useTranslations();
  const back = useBackNavigation();
  const router = useRouter();
  const session = useSession();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("settings.sessions.title")}
        onBack={() => {
          back("/settings");
        }}
      />
      <SessionsView
        onSignOutAll={async () => {
          await session.logoutAll();
          router.replace(LOGIN_PATH);
        }}
      />
    </div>
  );
}
