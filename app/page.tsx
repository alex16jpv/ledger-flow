import DashboardLayout from "./dashboard/layout";
import Dashboard from "./dashboard/page";

export default function Home() {
  return (
    <DashboardLayout>
      <Dashboard />
    </DashboardLayout>
  );
}
