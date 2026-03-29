import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import NewBudgetContainer from "./components/NewBudgetContainer";

export default function NewBudgetPage() {
  return (
    <>
      <Header title="New Budget">
        <ButtonLink
          icon="←"
          text="Back to Budgets"
          link="/budgets"
          bgColor="teal"
          textColor="text-stone-400"
          transparent={true}
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
          <NewBudgetContainer />
        </div>
      </main>
    </>
  );
}
