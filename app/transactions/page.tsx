import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import TransactionsContent from "./components/TransactionsContent";
import { MOCK_TRANSACTIONS } from "@/lib/mock/transactions.mock";

export default function TransactionsPage() {
  return (
    <>
      <Header title="Transactions">
        <ButtonLink
          icon="＋"
          text="New"
          link="/transactions/new"
          className="flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        <TransactionsContent transactions={MOCK_TRANSACTIONS} />
      </main>
    </>
  );
}
