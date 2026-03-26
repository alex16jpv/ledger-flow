import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import { MOCK_ACCOUNTS } from "@/lib/mock/accounts.mock";
import { ACCOUNT_TYPE_LABELS } from "@/utils/constants";
import AccountHero from "./components/AccountHero";
import AccountInfo from "./components/AccountInfo";
import AccountActions from "./components/AccountActions";
import AccountTransactions from "./components/AccountTransactions";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = MOCK_ACCOUNTS.find((a) => a.id === id);

  if (!account) {
    notFound();
  }

  const subtitle = `${ACCOUNT_TYPE_LABELS[account.type]}`;

  return (
    <>
      <Header title={account.name} subTitle={subtitle}>
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
          icon="＋"
          text="New Transaction"
          link="/transactions/new"
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        {/* Hero + stats row */}
        <section
          aria-label="Account summary"
          className="grid grid-cols-1 lg:grid-cols-4 gap-4"
        >
          <AccountHero account={account} />
        </section>

        {/* Transactions + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AccountTransactions account={account} />

          <div className="flex flex-col gap-4">
            <AccountInfo account={account} />
            <AccountActions />
          </div>
        </div>
      </main>
    </>
  );
}
