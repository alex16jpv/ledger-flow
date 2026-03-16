import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ButtonLink from "@/components/ButtonLink";
import { formatDate } from "@/utils/utils";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="flex-1 flex flex-col lg:ml-56 xl:ml-60 min-h-screen">
          <Header
            title="Dashboard"
            subTitle={formatDate({
              date: new Date(),
              options: { month: "long", year: "numeric" },
            })}
          >
            <ButtonLink
              icon="＋"
              text="New Transaction"
              link="/transactions/new"
              className="hidden sm:flex"
            />
          </Header>
          {children}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
