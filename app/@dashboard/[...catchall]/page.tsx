"use client";

import Main from "@/components/dashboard";
import { Sidebar } from "@/components/menu/side-bar";
import { AnimatePresence } from "motion/react";

export default function Dashboard() {
  return (
    <div className="flex" key="dashboard">
      <AnimatePresence>
        <Sidebar key="sideBar" />
        <Main key={"main"} />
      </AnimatePresence>
    </div>
  );
}
