import ButtonLink from "@/components/ButtonLink";
import Header from "@/components/Header";

export default function NewTransactionPage() {
  return (
    <>
      <Header title="New Transaction">
        <ButtonLink
          icon="←"
          text="Back to Transactions"
          link="/transactions"
          bgColor="teal"
          textColor="text-stone-400"
          transparent={true}
          className="hidden sm:flex"
        />
      </Header>

      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">New Transaction</h1>
        <p>This is the new transaction page.</p>
      </div>
    </>
  );
}
