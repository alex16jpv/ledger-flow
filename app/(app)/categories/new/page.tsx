import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import NewCategoryContainer from "./components/NewCategoryContainer";

export default function NewCategoryPage() {
  return (
    <>
      <Header title="New Category" subTitle="Create a new category">
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
          <NewCategoryContainer />
        </div>
      </main>
    </>
  );
}
