import { Account } from "@/types/Account.types";
import { ACCOUNT_TYPE_LABELS } from "@/utils/constants";
import { formatDate } from "@/lib/dates";

export default function AccountInfo({ account }: { account: Account }) {
  const rows = [
    { label: "Name", value: account.name },
    { label: "Type", value: ACCOUNT_TYPE_LABELS[account.type] },
    { label: "Created", value: formatDate(account.createdAt, "display") },
    { label: "Last updated", value: formatDate(account.updatedAt, "display") },
  ];

  return (
    <div className="bg-white border border-stone-100 rounded-xl p-5">
      <p className="font-mono text-[10px] text-stone-400 uppercase tracking-widest mb-4">
        Account Information
      </p>
      <dl className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="flex justify-between items-start">
              <dt className="font-mono text-xs text-stone-400">{row.label}</dt>
              <dd className="text-sm text-stone-700 text-right">{row.value}</dd>
            </div>
            {i < rows.length - 1 && <div className="h-px bg-stone-50 mt-3" />}
          </div>
        ))}
      </dl>
    </div>
  );
}
