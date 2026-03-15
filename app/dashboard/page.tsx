export default function Dashboard() {
  return (
    <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
      {/* <!-- ── ROW 1: Cash flow summary cards ─────────────────── --> */}
      <section aria-label="Resumen del mes" className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-stone-100 rounded-xl p-5">
          <p className="font-mono text-xs tracking-widest text-stone-400 uppercase mb-2">
            Ingresos · Mar
          </p>
          <p className="font-display text-3xl font-medium text-teal-800 leading-none mb-2">
            $8,450
          </p>
          <div className="flex items-center gap-2">
            <span className="bg-teal-50 text-teal-600 font-mono text-xs px-2 py-0.5 rounded-full">
              +12%
            </span>
            <span className="text-xs text-stone-400">vs feb</span>
          </div>
        </div>

        <div className="bg-white border border-stone-100 rounded-xl p-5">
          <p className="font-mono text-xs tracking-widest text-stone-400 uppercase mb-2">
            Gastos · Mar
          </p>
          <p className="font-display text-3xl font-medium text-stone-800 leading-none mb-2">
            $6,320
          </p>
          <div className="flex items-center gap-2">
            <span className="bg-red-50 text-red-600 font-mono text-xs px-2 py-0.5 rounded-full">
              +8%
            </span>
            <span className="text-xs text-stone-400">vs feb</span>
          </div>
        </div>

        <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
          <p className="font-mono text-xs tracking-widest text-teal-600 uppercase mb-2">
            Balance neto
          </p>
          <p className="font-display text-3xl font-medium text-teal-800 leading-none mb-2">
            +$2,130
          </p>
          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 font-mono text-xs px-2 py-0.5 rounded-full">
              25% ahorro
            </span>
          </div>
        </div>
      </section>

      {/* <!-- ── ROW 2: Transactions + Budgets ──────────────────── --> */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* <!-- Transactions list (2/3 width on desktop) --> */}
        <div className="lg:col-span-2 bg-white border border-stone-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
            <h2 className="text-sm font-medium text-stone-800">
              Transacciones recientes
            </h2>
            <a
              href="04-movimientos.html"
              className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
            >
              ver todo →
            </a>
          </div>

          <ul className="divide-y divide-stone-50" role="list">
            <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shrink-0">
                🛒
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  Mercado Libre
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Compras · Banco Nación
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium text-stone-700">
                  −$3,200
                </p>
                <p className="font-mono text-[10px] text-stone-300 mt-0.5">
                  14 mar · 16:40
                </p>
              </div>
            </li>

            <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shrink-0">
                💼
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  Salario empresa
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Ingreso · Galicia
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium text-teal-600">
                  +$8,450
                </p>
                <p className="font-mono text-[10px] text-stone-300 mt-0.5">
                  13 mar · 09:00
                </p>
              </div>
            </li>

            <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg shrink-0">
                🍔
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  Rappi — cena
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Comida · Tarjeta Visa
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium text-stone-700">
                  −$850
                </p>
                <p className="font-mono text-[10px] text-stone-300 mt-0.5">
                  13 mar · 21:15
                </p>
              </div>
            </li>

            <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-base font-mono font-medium text-blue-600 shrink-0">
                ⇄
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  Transfer → Ahorro
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Movimiento interno
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium text-blue-600">
                  ⇄ $2,000
                </p>
                <p className="font-mono text-[10px] text-stone-300 mt-0.5">
                  12 mar · 12:30
                </p>
              </div>
            </li>

            <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-lg shrink-0">
                🏠
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">
                  Alquiler marzo
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Hogar · Banco Nación
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-medium text-stone-700">
                  −$28,000
                </p>
                <p className="font-mono text-[10px] text-stone-300 mt-0.5">
                  12 mar · 10:00
                </p>
              </div>
            </li>
          </ul>
        </div>

        {/* <!-- Budgets panel (1/3 width on desktop) --> */}
        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
            <h2 className="text-sm font-medium text-stone-800">
              Budgets del mes
            </h2>
            <a
              href="05-budgets.html"
              className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
            >
              gestionar →
            </a>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-stone-800">
                  🍔 Comida
                </span>
                <span className="font-mono text-xs text-stone-400">
                  $4,200 / $5,000
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="h-full rounded-full bg-amber-200"
                  style={{ width: "84%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-stone-800">
                  🚌 Transporte
                </span>
                <span className="font-mono text-xs text-stone-400">
                  $1,100 / $3,000
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="h-full rounded-full bg-teal-400"
                  style={{ width: "37%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-stone-800">
                  🎬 Entretenimiento
                </span>
                <span className="font-mono text-xs text-red-600">
                  $2,400 / $2,000
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="h-full rounded-full bg-red-400"
                  style={{ width: "100%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-stone-800">
                  🏠 Hogar
                </span>
                <span className="font-mono text-xs text-stone-400">
                  $28,000 / $30,000
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: "93%" }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-medium text-stone-800">
                  💊 Salud
                </span>
                <span className="font-mono text-xs text-stone-400">
                  $680 / $2,000
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="h-full rounded-full bg-teal-400"
                  style={{ width: "34%" }}
                ></div>
              </div>
            </div>
          </div>

          {/* <!-- Insight alert --> */}
          <div className="mx-4 mb-4 bg-purple-50 border border-purple-200 rounded-xl p-3.5 flex gap-2.5 items-start">
            <span className="text-base shrink-0 mt-0.5">✦</span>
            <div>
              <p className="text-xs font-medium text-purple-800 mb-0.5">
                Entretenimiento superado
              </p>
              <p className="text-xs text-purple-600 leading-relaxed">
                $400 sobre el límite. Quedan 17 días del mes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* <!-- ── ROW 3: Accounts overview ────────────────────────── --> */}
      <section aria-label="Resumen de cuentas">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-stone-800">Mis cuentas</h2>
          <a
            href="03-cuentas.html"
            className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
          >
            ver cuentas →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
            <p className="font-mono text-[10px] tracking-widest text-teal-600 uppercase mb-1.5">
              Débito
            </p>
            <p className="text-sm font-medium text-teal-800 mb-3">
              Banco Nación
            </p>
            <p className="font-display text-2xl font-medium text-teal-800">
              $32,400
            </p>
            <div className="sparkline mt-3 h-8" aria-hidden="true">
              <div
                className="spark-bar bg-teal-100"
                style={{ height: "100%" }}
              ></div>
              <div
                className="spark-bar bg-teal-200"
                style={{ height: "100%" }}
              ></div>
              <div
                className="spark-bar bg-teal-300"
                style={{ height: "100%" }}
              ></div>
              <div
                className="spark-bar bg-teal-400"
                style={{ height: "100%" }}
              ></div>
              <div
                className="spark-bar bg-teal-500"
                style={{ height: "65%" }}
              ></div>
              <div
                className="spark-bar bg-teal-950"
                style={{ height: "90%" }}
              ></div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="font-mono text-[10px] tracking-widest text-purple-600 uppercase mb-1.5">
              Ahorro
            </p>
            <p className="text-sm font-medium text-purple-800 mb-3">
              Galicia Ahorro
            </p>
            <p className="font-display text-2xl font-medium text-purple-800">
              $18,750
            </p>
            <div className="sparkline mt-3 h-8" aria-hidden="true">
              <div
                className="spark-bar bg-purple-200"
                style={{ height: "50%" }}
              ></div>
              <div
                className="spark-bar bg-purple-200"
                style={{ height: "60%" }}
              ></div>
              <div
                className="spark-bar bg-purple-200"
                style={{ height: "70%" }}
              ></div>
              <div
                className="spark-bar bg-purple-400"
                style={{ height: "80%" }}
              ></div>
              <div
                className="spark-bar bg-purple-400"
                style={{ height: "90%" }}
              ></div>
              <div
                className="spark-bar bg-purple-400"
                style={{ height: "95%" }}
              ></div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="font-mono text-[10px] tracking-widest text-amber-600 uppercase mb-1.5">
              Crédito
            </p>
            <p className="text-sm font-medium text-amber-600 mb-3">
              Visa Santander
            </p>
            <p className="font-display text-2xl font-medium text-amber-600">
              −$5,200
            </p>
            <div className="sparkline mt-3 h-8" aria-hidden="true">
              <div
                className="spark-bar bg-amber-200"
                style={{ height: "20%" }}
              ></div>
              <div
                className="spark-bar bg-amber-200"
                style={{ height: "35%" }}
              ></div>
              <div
                className="spark-bar bg-amber-200"
                style={{ height: "50%" }}
              ></div>
              <div
                className="spark-bar bg-amber-400"
                style={{ height: "70%" }}
              ></div>
              <div
                className="spark-bar bg-amber-400"
                style={{ height: "80%" }}
              ></div>
              <div
                className="spark-bar bg-amber-200"
                style={{ height: "65%" }}
              ></div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="font-mono text-[10px] tracking-widest text-blue-600 uppercase mb-1.5">
              Digital
            </p>
            <p className="text-sm font-medium text-blue-600 mb-3">
              Mercado Pago
            </p>
            <p className="font-display text-2xl font-medium text-blue-600">
              $4,100
            </p>
            <div className="sparkline mt-3 h-8" aria-hidden="true">
              <div
                className="spark-bar bg-blue-100"
                style={{ height: "60%" }}
              ></div>
              <div
                className="spark-bar bg-blue-100"
                style={{ height: "50%" }}
              ></div>
              <div
                className="spark-bar bg-blue-100"
                style={{ height: "70%" }}
              ></div>
              <div
                className="spark-bar bg-blue-100"
                style={{ height: "55%" }}
              ></div>
              <div
                className="spark-bar bg-blue-100"
                style={{ height: "45%" }}
              ></div>
              <div
                className="spark-bar bg-blue-400"
                style={{ height: "60%" }}
              ></div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
