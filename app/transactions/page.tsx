import ButtonLink from "@/components/ButtonLink";
import Header from "@/components/Header";

export default function TransactionsPage() {
  return (
    <>
      <Header title="Transactions">
        <ButtonLink
          icon="＋"
          text="New Transaction"
          link="/transactions/new"
          bgColor="teal"
          className="hidden sm:flex"
        />
      </Header>

      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Transactions</h1>
        <p>This is the transactions page.</p>
      </div>
    </>
  );
}
