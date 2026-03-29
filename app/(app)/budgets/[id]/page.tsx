import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import { MOCK_BUDGETS } from "@/lib/mock/budgets.mock";
import BudgetHero from "./components/BudgetHero";
import BudgetInfo from "./components/BudgetInfo";
import BudgetTransactions from "./components/BudgetTransactions";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const budget = MOCK_BUDGETS.find((b) => b.id === id);

  if (!budget) {
    notFound();
  }

  return (
    <>
      <Header
        title={`${budget.emoji} ${budget.name}`}
        subTitle="Monthly budget"
      >
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

      <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <BudgetTransactions budget={budget} />

          <div className="flex flex-col gap-4">
            <BudgetHero budget={budget} />
            <BudgetInfo budget={budget} />
          </div>
        </div>
      </main>
    </>
  );
}
