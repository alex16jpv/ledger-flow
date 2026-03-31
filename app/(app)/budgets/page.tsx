import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import BudgetsPageContent from "./components/BudgetsPageContent";

export default function BudgetsPage() {
  return (
    <>
      <Header title="Budgets">
        <ButtonLink
          icon="＋"
          text="New Budget"
          link="/budgets/new"
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        <BudgetsPageContent />
      </main>
    </>
  );
}
