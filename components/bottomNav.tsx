import Link from "next/link";

export default function BottomNav() {
  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100"
        aria-label="Navegación móvil"
      >
        <ul className="flex justify-around py-2" role="list">
          <li>
            <Link
              href="/dashboard"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">⊞</span>
              <span className="w-1 h-1 rounded-full bg-teal-400"></span>
              <span className="font-mono text-[10px] text-teal-600">Home</span>
            </Link>
          </li>
          <li>
            <Link
              href="/transactions"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">↕</span>
              <span className="font-mono text-[10px] text-stone-400">
                Transactions
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/accounts"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">◈</span>
              <span className="font-mono text-[10px] text-stone-400">
                Accounts
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/budgets"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">◎</span>
              <span className="font-mono text-[10px] text-stone-400">
                Budgets
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/reports"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">⌇</span>
              <span className="font-mono text-[10px] text-stone-400">
                Reports
              </span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="lg:hidden h-16"></div>
    </>
  );
}
