import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import CategoriesContent from "./components/CategoriesContent";

export default function CategoriesPage() {
  return (
    <>
      <Header title="Categories">
        <ButtonLink
          icon="＋"
          text="New Category"
          link="/categories/new"
          className="flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto">
          <CategoriesContent />
        </div>
      </main>
    </>
  );
}
