import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-stone-100 px-5 lg:px-8 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display font-medium text-lg text-stone-900">
            Dashboard
          </h1>
          <p className="hidden sm:block font-mono text-[11px] text-stone-400 -mt-0.5">
            March 2025
          </p>
        </div>
      </div>

      {/* <!-- Right actions --> */}
      <div className="flex items-center gap-2">
        {/* <button
          aria-label="Notificaciones"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-100 bg-stone-50 hover:bg-stone-100 transition-colors text-sm"
        >
          🔔
        </button> */}
        <Link
          href="/new-transaction"
          className="hidden sm:flex items-center gap-1.5 bg-teal-400 hover:bg-teal-600 text-white text-sm font-medium rounded-lg px-3.5 py-2 transition-colors"
        >
          <span className="text-base leading-none">＋</span>
          New Transaction
        </Link>
      </div>
    </header>
  );
}
