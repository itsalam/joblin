"use client";

import Main from "@/components/dashboard";
import { Sidebar } from "@/components/menu/side-bar";
import { useSession } from "next-auth/react";
import { DashboardProvider } from "../(providers)/DashboardProvider";

export default function Dashboard() {
  const { data: session, status } = useSession();

  if (!session) {
    return null;
  }

  return (
    <div className="flex" key="dashboard">
      <Sidebar />
      <DashboardProvider>
        <Main />
      </DashboardProvider>
    </div>
  );
}
