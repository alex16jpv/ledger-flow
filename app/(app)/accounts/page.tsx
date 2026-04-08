import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import AccountsContent from "./components/AccountsContent";
import RecentTransactions from "./components/RecentTransactions";

export default function AccountsPage() {
  return (
    <>
      <Header title="Accounts">
        <ButtonLink
          icon="＋"
          text="New Account"
          link="/accounts/new"
          className="flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        <AccountsContent />
        <RecentTransactions />
      </main>
    </>
  );
}
