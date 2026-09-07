"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

import { type AddOptions, isActive, NAV_ITEMS, TAB_ITEMS } from "./nav";

export const HOLD_TO_CHAIN_MS = 500;

interface TabBarProps {
  pendingCount: number;
  onAdd: (options: AddOptions) => void;
}

export function TabBar({ pendingCount, onAdd }: TabBarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function startHold() {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onAdd({ chain: true });
    }, HOLD_TO_CHAIN_MS);
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function handleClick() {
    if (held.current) {
      held.current = false;
      return;
    }
    onAdd({ chain: false });
  }

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
            <button
              type="button"
              aria-label={t("addExpense")}
              aria-haspopup="dialog"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onContextMenu={(event) => {
                event.preventDefault();
              }}
              onClick={handleClick}
              className="grid size-[52px] -translate-y-2.5 touch-none place-items-center rounded-full bg-brand text-on-brand shadow-[var(--shadow-2),0_0_0_4px_var(--bg)] transition-[transform,background] duration-(--dur-1) ease-(--ease) select-none hover:bg-brand-hover focus-visible:shadow-[var(--shadow-2),0_0_0_4px_var(--bg),0_0_0_7px_var(--focus-ring)] focus-visible:outline-none active:scale-95"
            >
              <Plus size={26} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        ),
      )}
    </nav>
  );
}
