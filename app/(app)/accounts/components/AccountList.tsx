import { Account } from "@/types/Account.types";
import AccountCard from "./AccountCard";

export default function AccountList({ accounts }: { accounts: Account[] }) {
  if (accounts.length === 0) {
    return (
      <div className="bg-white border border-stone-100 rounded-xl p-8 text-center">
        <p className="text-sm text-stone-400">No accounts found</p>
      </div>
    );
  }

  return (
    <section aria-label="Accounts">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((account, index) => (
          <AccountCard key={account.id} account={account} index={index} />
        ))}
      </div>
    </section>
  );
}
