import Budgets from "./components/Budgets";
import Transactions from "./components/Transactions";

export default function Dashboard() {
  return (
    <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
      {/* <!-- ── ROW 1: Cash flow summary cards ─────────────────── --> */}
      {/* <section aria-label="Monthly summary" className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-stone-100 rounded-xl p-5">
          <p className="font-mono text-xs tracking-widest text-stone-400 uppercase mb-2">
            Incomes · Mar
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
            Expenses · Mar
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
            Net Balance
          </p>
          <p className="font-display text-3xl font-medium text-teal-800 leading-none mb-2">
            +$2,130
          </p>
          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 font-mono text-xs px-2 py-0.5 rounded-full">
              25% savings
            </span>
          </div>
        </div>
      </section> */}

      {/* <!-- ── ROW 2: Transactions + Budgets ──────────────────── --> */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* <!-- Transactions list (2/3 width on desktop) --> */}
        <Transactions />

        {/* <!-- Budgets panel (1/3 width on desktop) --> */}
        <Budgets />
      </section>

      {/* <!-- ── ROW 3: Accounts overview ────────────────────────── --> */}
      {/* <section aria-label="Accounts overview">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-stone-800">My accounts</h2>
          <Link
            href="/accounts"
            className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
          >
            view accounts →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
            <p className="font-mono text-[10px] tracking-widest text-teal-600 uppercase mb-1.5">
              Debit
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
              Savings
            </p>
            <p className="text-sm font-medium text-purple-800 mb-3">
              Galicia Savings
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
              Credit
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
              Digital Wallet
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
      </section> */}
    </main>
  );
}
