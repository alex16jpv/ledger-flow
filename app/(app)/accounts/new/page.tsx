import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import NewAccountContainer from "./components/NewAccountContainer";

export default function NewAccountPage() {
  return (
    <>
      <Header title="New Account" subTitle="Add a new account">
        <ButtonLink
          icon="←"
          text="Back to Accounts"
          link="/accounts"
          bgColor="teal"
          textColor="text-stone-400"
          transparent={true}
          className="hidden sm:flex"
        />
      </Header>

      <main className="flex-1 px-5 lg:px-8 py-6">
        <div className="max-w-lg mx-auto">
          <NewAccountContainer />
        </div>
      </main>
    </>
  );
}
