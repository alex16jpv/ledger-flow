"use client";

import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ProfileView } from "@/features/settings/components/ProfileView";
import { useBackNavigation } from "@/lib/navigation/history";
import { useSession } from "@/lib/session";

export function ProfileScreen() {
  const t = useTranslations();
  const back = useBackNavigation();
  const toast = useToast();
  const { user } = useSession();
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <PageHeader
        title={t("settings.credentials.pageTitle")}
        onBack={() => {
          back("/settings");
        }}
      />
      {user ? (
        <ProfileView
          key={user.id}
          user={user}
          onSaved={(reauthenticated) => {
            toast.show({
              message: reauthenticated
                ? t("settings.credentials.savedReauth")
                : t("settings.credentials.saved"),
            });
          }}
        />
      ) : (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
    </div>
  );
}
