import { authOptions } from "@/lib/auth";
import { DateRanges } from "@/lib/consts";
import { DashboardParams, StatisticKey } from "@/types";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { DashboardProvider } from "../../components/providers/DashboardProvider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
  initalDashboardParams?: DashboardParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const cookieStore = await cookies();

  const cookiesParams = (() => {
    try {
      return JSON.parse(cookieStore.get("dashboard-params")?.value || "{}");
    } catch (e) {
      console.error("Error parsing dashboard params from cookies", e);
      return {};
    }
  })() as Partial<DashboardParams>;

  const defaultDashboardParams: DashboardParams = {
    displayedStatistics: ["TOTAL_APPLICATIONS"] as StatisticKey[],
    dateKey: DateRanges.Monthly,
    filters: [],
    applicationPageIndex: 0,
    applicationSortKey: "last_updated",
    emailPageIndex: 0,
    emailSortKey: "sent_on",
  };

  return (
    <DashboardProvider
      initalDashboardParams={{ ...defaultDashboardParams, ...cookiesParams }}
    >
      {children}
    </DashboardProvider>
  );
}
