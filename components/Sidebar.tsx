"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_ITEMS, getActiveHref } from "@/utils/navigation";
import { logout } from "@/services/auth.service";
import CacheMenu from "@/components/CacheMenu";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeHref = getActiveHref(NAV_ITEMS, pathname);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

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

          if (item.disabled) {
            return (
              <span
                key={item.href}
                className="nav-link opacity-50 cursor-not-allowed"
                aria-disabled="true"
                role="link"
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive ? " active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-stone-100 flex flex-col gap-1">
        <CacheMenu direction="up" />
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="nav-link w-full text-left text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <span className="text-base leading-none">🚪</span>
          <span>{isLoggingOut ? "Signing out…" : "Sign out"}</span>
        </button>
      </div>
    </aside>
  );
}
