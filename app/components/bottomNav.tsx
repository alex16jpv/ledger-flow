export default function BottomNav() {
  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-100"
        aria-label="Navegación móvil"
      >
        <ul className="flex justify-around py-2" role="list">
          <li>
            <a
              href="01-dashboard.html"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">⊞</span>
              <span className="w-1 h-1 rounded-full bg-teal-400"></span>
              <span className="font-mono text-[10px] text-teal-600">
                inicio
              </span>
            </a>
          </li>
          <li>
            <a
              href="04-movimientos.html"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">↕</span>
              <span className="font-mono text-[10px] text-stone-400">
                movimientos
              </span>
            </a>
          </li>
          <li>
            <a
              href="03-cuentas.html"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">◈</span>
              <span className="font-mono text-[10px] text-stone-400">
                cuentas
              </span>
            </a>
          </li>
          <li>
            <a
              href="05-budgets.html"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">◎</span>
              <span className="font-mono text-[10px] text-stone-400">
                budgets
              </span>
            </a>
          </li>
          <li>
            <a
              href="06-reportes.html"
              className="flex flex-col items-center gap-1 px-3 py-1"
            >
              <span className="text-lg leading-none">⌇</span>
              <span className="font-mono text-[10px] text-stone-400">
                reportes
              </span>
            </a>
          </li>
        </ul>
      </nav>
      <div className="lg:hidden h-16"></div>
    </>
  );
}
