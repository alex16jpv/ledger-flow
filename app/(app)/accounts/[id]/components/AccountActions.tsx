import Link from "next/link";

export default function AccountActions({
  accountId,
  onDelete,
  isDeleting,
}: {
  accountId: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="bg-white border border-stone-100 rounded-xl p-5">
      <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-3">
        Quick Actions
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/transactions/new"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-teal-50 transition-colors group"
        >
          <span className="w-7 h-7 rounded-lg bg-teal-50 group-hover:bg-teal-100 flex items-center justify-center text-sm transition-colors">
            ＋
          </span>
          <span className="text-sm text-stone-700 group-hover:text-teal-800 transition-colors">
            New Transaction
          </span>
        </Link>

        <Link
          href={`/accounts/${accountId}/edit`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-blue-50 transition-colors group"
        >
          <span className="w-7 h-7 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-sm transition-colors">
            ✎
          </span>
          <span className="text-sm text-stone-700 group-hover:text-blue-800 transition-colors">
            Edit Account
          </span>
        </Link>

        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-red-50 transition-colors group disabled:opacity-50 w-full text-left"
        >
          <span className="w-7 h-7 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center text-sm transition-colors">
            🗑
          </span>
          <span className="text-sm text-stone-700 group-hover:text-red-800 transition-colors">
            {isDeleting ? "Deleting…" : "Delete Account"}
          </span>
        </button>
      </div>
    </div>
  );
}
