"use client";

import { ChevronRight, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { useContactsQuery, useSharedSection } from "@/features/shared/hooks";
import { Link } from "@/lib/i18n/navigation";
import { useMoney } from "@/lib/i18n/useMoney";
import { iconProps } from "@/lib/icons/sizes";

// Never added to what you have, and never green: money somebody owes you is not money you have.
export function OwedLine() {
  const t = useTranslations("home");
  const money = useMoney();
  // Nobody to share with means nothing to read: the section's own query waits for a contact.
  const contacts = useContactsQuery();
  const shared = useSharedSection((contacts.data ?? []).length > 0);
  const section = shared.section;
  if (!section || (section.owedToYou === 0 && section.youOwe === 0)) return null;

  return (
    <Link
      href="/shared"
      className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-2 hover:bg-surface-2"
    >
      <Users {...iconProps("sm")} className="shrink-0 text-text-3" />
      <span className="min-w-0 flex-1">
        {section.youOwe > 0
          ? t("owedBothWays", {
              owed: money.format(section.owedToYou),
              owe: money.format(section.youOwe),
            })
          : t("owedToYou", { owed: money.format(section.owedToYou) })}
      </span>
      <ChevronRight {...iconProps("sm")} className="shrink-0 text-text-3" />
    </Link>
  );
}
