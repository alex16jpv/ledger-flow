import Link from "next/link";
import { NAV_ITEMS } from "@/utils/navigation";

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter(
  (item) => item.href !== "/transactions/new",
);

export default function BottomNav() {
  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100"
        aria-label="Mobile navigation"
      >
        <ul className="flex justify-around py-2" role="list">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex flex-col items-center gap-1 px-3 py-1"
              >
                <span className="text-lg leading-none">{item.icon}</span>
                {/* TODO: set active indicator based on current route */}
                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                <span className="font-mono text-[10px] text-stone-400">
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="lg:hidden h-16"></div>
    </>
  );
}
