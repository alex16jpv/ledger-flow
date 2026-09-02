"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

import { ADD_HREF, isActive, NAV_ITEMS, TAB_ITEMS } from "./nav";

interface TabBarProps {
  pendingCount: number;
}

export function TabBar({ pendingCount }: TabBarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = TAB_ITEMS.map((key) => NAV_ITEMS.find((item) => item.key === key)).filter(
    (item): item is (typeof NAV_ITEMS)[number] => item !== undefined,
  );
  const [first, second, third, fourth] = items;
  const tabs = [first, second, null, third, fourth];

  return (
    <nav
      aria-label={t("label")}
      className="z-(--z-nav) grid h-(--tabbar-h) min-w-0 grid-cols-5 items-end border-t border-border bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      {tabs.map((item, index) =>
        item ? (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
            className={cn(
              "relative flex h-(--tabbar-h) flex-col items-center justify-center gap-[3px] text-xs font-medium",
              isActive(pathname, item.href)
                ? "text-brand-text [&>svg]:stroke-[2.25]"
                : "text-text-3",
            )}
          >
            <item.icon {...iconProps("md")} />
            <span>{t(item.key)}</span>
            {item.key === "transactions" && pendingCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-3 right-[calc(50%-14px)] size-[7px] rounded-full border-2 border-surface bg-warning-solid"
              />
            )}
          </Link>
        ) : (
          <div key={index} className="flex h-(--tabbar-h) items-center justify-center">
            <Link
              href={ADD_HREF}
              aria-label={t("addExpense")}
              className="grid size-[52px] -translate-y-2.5 place-items-center rounded-full bg-brand text-on-brand shadow-[var(--shadow-2),0_0_0_4px_var(--bg)] transition-[transform,background] duration-(--dur-1) ease-(--ease) hover:bg-brand-hover active:scale-95"
            >
              <Plus size={26} strokeWidth={2.25} aria-hidden="true" />
            </Link>
          </div>
        ),
      )}
    </nav>
  );
}
