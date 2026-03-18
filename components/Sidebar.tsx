import Link from "next/link";
import { NAV_ITEMS } from "@/utils/navigation";

export default function Sidebar() {
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
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            // TODO: Add active state based on current route
            // remove pointer events when all pages are implemented
            className={`nav-link${item.disabled ? " pointer-events-none" : ""}`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* <!-- User profile --> */}
      {/* <div className="px-4 py-4 border-t border-stone-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center font-mono text-xs font-medium text-purple-800 shrink-0">
          MA
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-800 truncate">
            John Doe
          </p>
          <p className="font-mono text-[10px] text-stone-400 truncate">
            Personal Account
          </p>
        </div>
      </div> */}
    </aside>
  );
}
