/*eslint-disable*/
"use client";

import {
  ApplicationData,
  useDashboard,
} from "@/app/(providers)/DashboardProvider";
import MainChart from "@/components/dashboard/cards/EmailBreakdownChart";
import { setEmailItem } from "@/lib/clientCache";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Header from "../menu/header";
import ApplicationTable from "./cards/ApplicationTable";
import Emails from "./cards/Emails";
import MenuBar from "./cards/MenuBar";

interface Props {
  // user: User | null | undefined;
  // userDetails: { [x: string]: any } | null | any;
}

type FetchData = { chartData: ApplicationData; emails: CategorizedEmail[] };

export default function Main(props: Props) {
  const baseURL = "/api/user/emails";
  const { emails, setEmails, chartData, setChartData, options } =
    useDashboard();
  const [isFetching, setIsFetching] = useState(false);
  const latestData = useRef<FetchData>({ chartData, emails });

  useEffect(() => {
    setIsFetching(true);
    const searchParams = new URLSearchParams({
      dateRange: options.dateKey,
      ...(options.absolute ? { absolute: "1" } : {}),
    });
    const url = `${baseURL}?${searchParams.toString()}`;
    fetch(url)
      .then((x) => {
        return x.json() as Promise<FetchData>;
      })
      .then((data) => {
        setIsFetching(false);
        latestData.current = data;
        setEmails(data.emails);
        data.emails.forEach((email) => {
          setEmailItem(email.id, email);
        });
      });
  }, [options]);

  return (
    <motion.div
      layout
      className="dark:bg-background-900 flex flex-col h-full w-full bg-white"
    >
      <Header>
        <MenuBar />
      </Header>
      <div className="h-full w-full dark:bg-zinc-950">
        <main className={`mx-2.5 flex-none transition-all dark:bg-zinc-950`}>
          <div className="mx-auto min-h-screen p-2">
            <div className="h-full w-full flex flex-col gap-5">
              <MainChart isFetching={isFetching} {...latestData.current} />
              {/* Conversion and talbes*/}
              <Emails emails={latestData.current.emails} />
              <ApplicationTable />
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}
