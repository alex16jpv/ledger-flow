"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";

import { cn } from "@/components/ui/cn";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { iconProps } from "@/lib/icons/sizes";

import { type AddOptions, isActive, MORE_ICON, MORE_ITEMS, NAV_ITEMS, TAB_SLOTS } from "./nav";

export const HOLD_TO_CHAIN_MS = 500;

interface TabBarProps {
  pendingCount: number;
  moreOpen: boolean;
  onAdd: (options: AddOptions) => void;
  onMore: () => void;
}

const SLOT =
  "relative flex h-(--tabbar-h) flex-col items-center justify-center gap-[3px] text-xs font-medium";

function slotClasses(active: boolean) {
  return cn(SLOT, active ? "text-brand-text [&>svg]:stroke-[2.25]" : "text-text-3");
}

export function TabBar({ pendingCount, moreOpen, onAdd, onMore }: TabBarProps) {
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

  const behindMore = MORE_ITEMS.some((item) => isActive(pathname, item.href));

  return (
    <nav
      aria-label={t("label")}
      className="z-(--z-nav) grid h-(--tabbar-h) min-w-0 grid-cols-5 items-end border-t border-border bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-(--nav-blur) md:hidden"
    >
      {TAB_SLOTS.map((slot) => {
        if (slot === "add") {
          return (
            <div key={slot} className="flex h-(--tabbar-h) items-center justify-center">
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
          );
        }
        if (slot === "more") {
          return (
            <button
              key={slot}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={onMore}
              className={slotClasses(behindMore || moreOpen)}
            >
              <MORE_ICON {...iconProps("md")} />
              <span>{t("more")}</span>
            </button>
          );
        }
        const item = NAV_ITEMS.find((candidate) => candidate.key === slot);
        if (!item) return null;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={slotClasses(active)}
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
        );
      })}
    </nav>
  );
}
