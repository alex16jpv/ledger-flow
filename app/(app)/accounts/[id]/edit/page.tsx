import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import EditAccountContainer from "./components/EditAccountContainer";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Header title="Edit Account">
        <ButtonLink
          icon="←"
          text="Back to Account"
          link={`/accounts/${id}`}
          bgColor="teal"
          textColor="text-stone-400"
          transparent={true}
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6">
        <div className="max-w-lg mx-auto">
          <EditAccountContainer id={id} />
        </div>
      </main>
    </>
  );
}
