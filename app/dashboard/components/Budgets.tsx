// All the content on this component must be on english

export default function Budgets() {
  return (
    <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="text-sm font-medium text-stone-800">Monthly Budgets</h2>
        <a
          href="05-budgets.html"
          className="font-mono text-xs text-teal-600 hover:text-teal-800 transition-colors"
        >
          Manage →
        </a>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-medium text-stone-800">🍔 Food</span>
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
              🚌 Transportation
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
              🎬 Entertainment
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
            <span className="text-sm font-medium text-stone-800">🏠 Home</span>
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
              💊 Health
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
            Entertainment exceeded
          </p>
          <p className="text-xs text-purple-600 leading-relaxed">
            $400 over the limit. 17 days left in the month.
          </p>
        </div>
      </div>
    </div>
  );
}
