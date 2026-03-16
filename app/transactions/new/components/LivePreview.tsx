import Link from "next/link";

export default function LivePreview() {
  return (
    <div className="lg:col-span-2 flex flex-col gap-5">
      <div className="sticky top-24 flex flex-col gap-4">
        {/* Preview card */}
        <div className="bg-white border border-stone-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <p className="text-sm font-medium text-stone-800">Preview</p>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Amount preview */}
            <div
              id="preview-amount-wrap"
              className="bg-red-50 rounded-xl p-4 text-center border border-red-100 transition-all"
            >
              <p
                id="preview-type-label"
                className="font-mono text-[10px] uppercase tracking-widest text-red-600 mb-1"
              >
                Expense
              </p>
              <p
                id="preview-amount"
                className="font-display text-3xl font-medium text-stone-800"
              >
                $0.00
              </p>
            </div>

            {/* Details */}
            <div className="flex flex-col gap-0">
              <div className="preview-row">
                <span className="font-mono text-xs text-stone-400">Type</span>
                <span id="preview-tipo" className="text-sm text-stone-700">
                  Expense
                </span>
              </div>

              <div className="preview-row" id="preview-account-row">
                <span className="font-mono text-xs text-stone-400">
                  Account
                </span>
                <span id="preview-account" className="text-sm text-stone-700">
                  Banco Nación
                </span>
              </div>

              <div
                className="preview-row"
                id="preview-transfer-row"
                style={{ display: "none" }}
              >
                <span className="font-mono text-xs text-stone-400">
                  Transfer
                </span>
                <span className="text-blue-600 font-mono text-xs">
                  Nación → Galicia
                </span>
              </div>

              <div className="preview-row" id="preview-cat-row">
                <span className="font-mono text-xs text-stone-400">
                  Category
                </span>
                <span className="text-sm text-stone-700">🚌 Transport</span>
              </div>

              <div className="preview-row">
                <span className="font-mono text-xs text-stone-400">Date</span>
                <span className="text-sm text-stone-700">
                  14 Mar 2025 · 12:00
                </span>
              </div>
            </div>

            {/* Budget impact (visible for gastos) */}
            {/* <div
              id="preview-budget"
              className="bg-stone-50 border border-stone-100 rounded-xl p-3.5"
            >
              <p className="font-mono text-[10px] text-stone-400 uppercase tracking-wider mb-2">
                Budget Impact
              </p>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-xs text-stone-600">Transport</span>
                <span className="font-mono text-xs text-stone-500">
                  $1,100 / $3,000
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-400"
                  style={{ width: "37%" }}
                ></div>
              </div>
            </div> */}

            {/* <!-- Save button --> */}
            <button
              id="save-btn"
              type="submit"
              className="w-full bg-red-400 hover:bg-red-600 text-white font-medium text-sm rounded-xl py-3 transition-colors"
            >
              Save Expense
            </button>

            <Link
              href="/transactions"
              className="text-center text-stone-400 hover:text-stone-600 font-mono text-xs py-1 transition-colors block"
            >
              Cancel
            </Link>
          </div>
        </div>

        {/* Tip */}
        {/* <div className="bg-stone-50 border border-stone-100 rounded-xl p-4 flex gap-3 items-start">
          <span className="text-base shrink-0 mt-0.5">💡</span>
          <p id="tip-text" className="text-xs text-stone-500 leading-relaxed">
            Press <strong className="text-stone-700">Tab</strong> to move
            between fields. Expenses will be automatically allocated to the
            selected category's budget.
          </p>
        </div> */}
      </div>
    </div>
  );
}
