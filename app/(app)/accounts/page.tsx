import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import AccountList from "./components/AccountList";
import RecentTransactions from "./components/RecentTransactions";
import { MOCK_ACCOUNTS } from "@/lib/mock/accounts.mock";

export default function AccountsPage() {
  const activeCount = MOCK_ACCOUNTS.length;

  return (
    <>
      <Header
        title="Accounts"
        subTitle={`${activeCount} active account${activeCount !== 1 ? "s" : ""}`}
      >
        <ButtonLink
          icon="＋"
          text="New Transaction"
          link="/transactions/new"
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        <AccountList accounts={MOCK_ACCOUNTS} />
        <RecentTransactions />
      </main>
    </>
  );
}
