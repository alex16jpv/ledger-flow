import ButtonLink from "@/components/ButtonLink";
import Header from "@/components/Header";
import TrxTypeSelector from "./components/TypeSelector";
import AmountInput from "./components/AmountInput";
import LivePreview from "./components/LivePreview";
import TransactionForm from "@/app/transactions/new/components/TransactionForm";

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

      <main className="flex-1 px-5 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 flex flex-col gap-5">
            <section className="bg-white border border-stone-100 rounded-xl p-6">
              <TrxTypeSelector />
              <AmountInput />
            </section>

            <TransactionForm />
          </div>

          <LivePreview />
        </div>
      </main>
    </>
  );
}
