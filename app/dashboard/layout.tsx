import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

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
          <Header />
          {children}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
