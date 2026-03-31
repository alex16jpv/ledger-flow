"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getAccount, deleteAccount } from "@/services/accounts.service";
import { Account } from "@/types/Account.types";
import { ACCOUNT_TYPE_LABELS } from "@/utils/constants";
import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import AccountHero from "./AccountHero";
import AccountInfo from "./AccountInfo";
import AccountActions from "./AccountActions";
import AccountTransactions from "./AccountTransactions";

export default function AccountDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getAccount(id);
    if (result.error) {
      setError(result.error);
    } else {
      setAccount(result.data);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    setIsDeleting(true);
    const result = await deleteAccount(id);
    if (result.error) {
      setError(result.error);
      setIsDeleting(false);
    } else {
      router.push("/accounts");
    }
  };

  if (isLoading) {
    return (
      <>
        <Header title="Loading…">
          <ButtonLink
            icon="←"
            text="Back to Accounts"
            link="/accounts"
            bgColor="teal"
            textColor="text-stone-400"
            transparent={true}
            className="hidden sm:flex"
          />
        </Header>
        <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 bg-white border border-stone-100 rounded-xl p-6 h-40 animate-pulse">
              <div className="h-3 w-20 bg-stone-100 rounded mb-2" />
              <div className="h-5 w-32 bg-stone-100 rounded mb-6" />
              <div className="h-10 w-40 bg-stone-100 rounded" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error || !account) {
    return (
      <>
        <Header title="Account not found">
          <ButtonLink
            icon="←"
            text="Back to Accounts"
            link="/accounts"
            bgColor="teal"
            textColor="text-stone-400"
            transparent={true}
            className="hidden sm:flex"
          />
        </Header>
        <main className="flex-1 px-5 lg:px-8 py-6">
          <div className="bg-red-50 border border-red-100 rounded-xl p-8 text-center">
            <p className="text-sm text-red-600 mb-3">
              {error ?? "Account not found"}
            </p>
            <button
              onClick={fetchAccount}
              className="text-sm text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={account.name} subTitle={ACCOUNT_TYPE_LABELS[account.type]}>
        <ButtonLink
          icon="←"
          text="Back to Accounts"
          link="/accounts"
          bgColor="teal"
          textColor="text-stone-400"
          transparent={true}
          className="hidden sm:flex"
        />
        <ButtonLink
          icon="✎"
          text="Edit"
          link={`/accounts/${id}/edit`}
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        <section
          aria-label="Account summary"
          className="grid grid-cols-1 lg:grid-cols-4 gap-4"
        >
          <AccountHero account={account} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AccountTransactions account={account} />

          <div className="flex flex-col gap-4">
            <AccountInfo account={account} />
            <AccountActions
              accountId={id}
              onDelete={handleDelete}
              isDeleting={isDeleting}
            />
          </div>
        </div>
      </main>
    </>
  );
}
