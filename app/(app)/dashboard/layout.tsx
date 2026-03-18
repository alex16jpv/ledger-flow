import Header from "@/components/Header";
import ButtonLink from "@/components/ButtonLink";
import { formatDate, getCurrentDate } from "@/lib/dates";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header
        title="Dashboard"
        subTitle={formatDate(getCurrentDate(), "monthYear")}
      >
        <ButtonLink
          icon="＋"
          text="New Transaction"
          link="/transactions/new"
          className="hidden sm:flex"
        />
      </Header>
      {children}
    </>
  );
}
