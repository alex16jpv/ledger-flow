"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV_ITEMS, getActiveHref } from "@/utils/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const activeHref = getActiveHref(BOTTOM_NAV_ITEMS, pathname);

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100"
        aria-label="Mobile navigation"
      >
        <ul className="flex justify-around py-2" role="list">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex flex-col items-center gap-1 px-3 py-1"
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  {isActive && (
                    <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                  )}
                  <span
                    className={`font-mono text-[10px] ${isActive ? "text-teal-600" : "text-stone-400"}`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="lg:hidden h-16"></div>
    </>
  );
}
