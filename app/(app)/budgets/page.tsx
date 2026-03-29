import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import BudgetSummary from "./components/BudgetSummary";
import BudgetCard from "./components/BudgetCard";
import BudgetAlerts from "./components/BudgetAlerts";
import { MOCK_BUDGETS } from "@/lib/mock/budgets.mock";

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
        <BudgetSummary budgets={MOCK_BUDGETS} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Budget cards (2/3) */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MOCK_BUDGETS.map((budget) => (
                <BudgetCard key={budget.id} budget={budget} />
              ))}
            </div>
          </div>

          {/* Right sidebar: alerts + add CTA (1/3) */}
          <BudgetAlerts budgets={MOCK_BUDGETS} />
        </div>
      </main>
    </>
  );
}
