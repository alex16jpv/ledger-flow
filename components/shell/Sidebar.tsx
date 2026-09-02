"use client";

import { Layers, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

import { Avatar } from "./Avatar";
import { ADD_HREF, isActive, NAV_ITEMS, type NavItem, SETTINGS_ITEM } from "./nav";

interface SidebarProps {
  userName: string;
  pendingCount: number;
}

function SidebarLink({ item, active, count }: { item: NavItem; active: boolean; count?: number }) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-[9px] text-base font-medium transition-[background,color] duration-(--dur-1) ease-(--ease)",
        active ? "bg-brand-soft text-brand-text" : "text-text-2 hover:bg-surface-2 hover:text-text",
      )}
    >
      <Icon {...iconProps("md")} />
      <span>{t(item.key)}</span>
      {count !== undefined && count > 0 && (
        <span className="ml-auto rounded-full bg-warning-soft px-[7px] py-px text-xs font-semibold text-warning">
          <span className="sr-only">{t("pendingCount", { count })}</span>
          <span aria-hidden="true">{count}</span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ userName, pendingCount }: SidebarProps) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  return (
    <aside className="hidden min-h-0 flex-col gap-1 overflow-y-auto border-r border-border bg-surface px-3 py-5 md:flex">
      <div className="flex items-center gap-2 px-3 pt-2 pb-5 text-md font-semibold">
        <span
          aria-hidden="true"
          className="grid size-[26px] place-items-center rounded-lg bg-brand text-on-brand"
        >
          <Layers {...iconProps("sm")} />
        </span>
        {tc("appName")}
      </div>
      <Link href={ADD_HREF} className={cn(buttonClasses({ block: true }), "mt-2 mb-3")}>
        <Plus {...iconProps("sm")} />
        {t("add")}
      </Link>
      <nav aria-label={t("label")} className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
            count={item.key === "transactions" ? pendingCount : undefined}
          />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        <SidebarLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
        <Link
          href={SETTINGS_ITEM.href}
          className="flex items-center gap-3 rounded-md px-3 py-[9px] text-base font-medium text-text-2 hover:bg-surface-2 hover:text-text"
        >
          <Avatar name={userName} size="sm" />
          <span className="truncate">{userName}</span>
        </Link>
      </div>
    </aside>
  );
}
