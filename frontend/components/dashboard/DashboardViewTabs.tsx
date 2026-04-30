"use client";

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { UI } from "@/styles/ui";

/**
 * Switches between overview (supervisor) and worker dashboards. URL is the source of truth.
 */
export function DashboardViewTabs() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const isOverview = pathname === "/overview" || pathname.startsWith("/overview/");
  const isWorker = pathname === "/worker" || pathname.startsWith("/worker/");

  return (
    <div className={UI.toggleGroup} role="navigation" aria-label="Dashboards">
      <Button variant={isWorker ? "accent" : "secondary"} type="button" onClick={() => router.push("/worker")}>
        Worker
      </Button>
      <Button variant={isOverview ? "accent" : "secondary"} type="button" onClick={() => router.push("/overview")}>
        Overview
      </Button>
    </div>
  );
}
