import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import BottomNav from "@/components/bottomNav";

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
