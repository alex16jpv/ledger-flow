"use client";

import { useEffect, useState, useCallback } from "react";
import { getAccounts } from "@/services/accounts.service";
import { Account } from "@/types/Account.types";
import AccountList from "./AccountList";

export default function AccountsContent() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAccounts();
    if (result.error) {
      setError(result.error);
    } else {
      setAccounts(result.data?.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  if (loading) {
    return (
      <section aria-label="Accounts loading">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-stone-100 rounded-xl p-5 h-40 animate-pulse"
            >
              <div className="h-3 w-16 bg-stone-100 rounded mb-2" />
              <div className="h-4 w-24 bg-stone-100 rounded mb-4" />
              <div className="h-8 w-32 bg-stone-100 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <button
          onClick={fetchAccounts}
          className="text-sm text-red-600 underline hover:text-red-800"
        >
          Try again
        </button>
      </div>
    );
  }

  return <AccountList accounts={accounts} />;
}
