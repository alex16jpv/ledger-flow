"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, getActiveHref } from "@/utils/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const activeHref = getActiveHref(NAV_ITEMS, pathname);

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 bg-white border-r border-stone-100 min-h-screen fixed top-0 left-0 z-30">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-stone-100">
        <span className="w-3 h-3 rounded-full bg-teal-400 shrink-0"></span>
        <span className="font-display font-semibold text-xl text-stone-900">
          Ledger Flow
        </span>
      </div>

      <nav
        className="flex-1 px-3 py-4 flex flex-col gap-1"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive ? " active" : ""}${item.disabled ? " pointer-events-none" : ""}`}
              aria-disabled={item.disabled || undefined}
              aria-current={isActive ? "page" : undefined}
              tabIndex={item.disabled ? -1 : undefined}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
