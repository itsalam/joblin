/*eslint-disable*/
"use client";

import MainChart from "@/components/charts/EmailChart/EmailBreakdownChart";
import ApplicationList from "./cards/Applications/ApplicationList";
import Emails from "./cards/Emails";
import MenuBar from "./cards/MenuBar";

export default function Main() {
  return (
    <div
      className="dark:bg-background-900 flex flex-col h-full w-full bg-white"
      key="dashboard"
    >
      <MenuBar />
      <div className="h-full w-full dark:bg-zinc-950">
        <main className={`mx-2.5 flex-none transition-all dark:bg-zinc-950`}>
          <div className="mx-auto min-h-screen p-2">
            <div className="h-full w-full flex flex-col gap-5">
              <MainChart />
              <Emails />
              <ApplicationList />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
