"use client";

import { useTranslations } from "next-intl";

import { Avatar, PageHeader } from "@/components/shell";
import { Link } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { useSession } from "@/lib/session";

export function HomeView() {
  const t = useTranslations("home");
  const tn = useTranslations("nav");
  const { user } = useSession();
  const dates = useDates();
  const firstName = user?.name.split(" ")[0] ?? "";

  return (
    <PageHeader
      eyebrow={dates.formatLong(new Date())}
      title={t("greeting", { name: firstName })}
      actions={
        <Link href="/settings" aria-label={tn("settings")} className="rounded-full">
          <Avatar name={user?.name ?? ""} />
        </Link>
      }
    />
  );
}
