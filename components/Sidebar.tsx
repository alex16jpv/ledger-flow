import Link from "next/link";

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
        <Link href="/dashboard" className="nav-link active" aria-current="page">
          <span className="text-base leading-none">⊞</span>
          <span>Dashboard</span>
        </Link>
        <Link href="/transactions/new" className="nav-link">
          <span className="text-base leading-none">＋</span>
          <span>New Transaction</span>
        </Link>
        <Link href="/transactions" className="nav-link">
          <span className="text-base leading-none">↕</span>
          <span>Transactions</span>
        </Link>
        <Link href="/accounts" className="nav-link pointer-events-none">
          <span className="text-base leading-none">◈</span>
          <span>Accounts</span>
        </Link>
        <Link href="/budgets" className="nav-link pointer-events-none">
          <span className="text-base leading-none">◎</span>
          <span>Budgets</span>
        </Link>
        <Link href="/reports" className="nav-link pointer-events-none">
          <span className="text-base leading-none">⌇</span>
          <span>Reports</span>
        </Link>
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
