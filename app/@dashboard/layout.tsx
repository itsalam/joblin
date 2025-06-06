import { authOptions } from "@/lib/auth";
import { DateRanges } from "@/lib/consts";
import { StatisticKey } from "@/types";
import { getServerSession } from "next-auth";
import { composeDashboardData } from "../(actions)/composeDashboard";
import { DashboardProvider } from "../../components/providers/DashboardProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const initalDashboardParams = {
    displayedStatistics: ["TOTAL_APPLICATIONS"] as StatisticKey[],
    dateKey: DateRanges.Monthly,
    filters: [],
  };

  const { emails, chartData } = await composeDashboardData(
    initalDashboardParams
  );

  return (
    <DashboardProvider
      fetchData={{ emails, chartData }}
      initalDashboardParams={initalDashboardParams}
    >
      {children}
    </DashboardProvider>
  );
}
