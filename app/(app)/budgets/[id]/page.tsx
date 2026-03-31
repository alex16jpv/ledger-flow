import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import BudgetDetailContent from "./components/BudgetDetailContent";

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Header title="Budget" subTitle="Monthly budget">
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
        <BudgetDetailContent id={id} />
      </main>
    </>
  );
}
