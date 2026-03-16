export default function TransactionItem() {
  return (
    <li className="flex items-center gap-4 px-6 py-3.5 hover:bg-stone-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shrink-0">
        🛒
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800">
          Transaction Description
        </p>
        <p className="text-xs text-stone-400 mt-0.5">Category · Account</p>
      </div>
      {/* Category Badge */}
      <div className="hidden sm:flex items-center gap-3">
        <span className="bg-teal-50 text-teal-800 font-mono text-[10px] px-2 py-0.5 rounded-full">
          Category
        </span>
      </div>
      <div className="text-right">
        {/* Expense */}
        {/* <p className="font-mono text-sm font-medium text-red-600">− $3,200</p> */}
        {/* Income */}
        {/* <p className="font-mono text-sm font-medium text-green-600">+ $3,200</p> */}
        {/* Transfer */}
        <p className="font-mono text-sm font-medium text-blue-600">⇄ $3,200</p>
        <p className="font-mono text-[10px] text-stone-300 mt-0.5">
          14 Mar · 16:40
        </p>
      </div>
    </li>
  );
}
