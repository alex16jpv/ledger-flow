import Budgets from "./components/Budgets";
import Transactions from "./components/Transactions";

export default function Dashboard() {
  return (
    <main className="flex-1 px-5 lg:px-8 py-6 flex flex-col gap-6">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Transactions />
        {/* <Budgets /> */}
      </section>
    </main>
  );
}
