import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import EditCategoryContainer from "./components/EditCategoryContainer";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <Header title="Edit Category">
        <ButtonLink
          icon="←"
          text="Back to Categories"
          link="/categories"
          bgColor="teal"
          textColor="text-stone-400"
          transparent={true}
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6">
        <div className="max-w-lg mx-auto">
          <EditCategoryContainer id={id} />
        </div>
      </main>
    </>
  );
}
