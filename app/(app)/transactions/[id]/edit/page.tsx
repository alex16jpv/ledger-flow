import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import EditTransactionContainer from "./components/EditTransactionContainer";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Header title="Edit Transaction">
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
          <EditTransactionContainer id={id} />
        </div>
      </main>
    </>
  );
}
