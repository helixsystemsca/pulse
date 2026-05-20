"use client";

import {
  OperationalDashboard,
  type OperationalDashboardReadyPayload,
} from "@/components/dashboard/OperationalDashboard";
import { PERMISSION_MATRIX_DEPARTMENTS } from "@/config/platform/permission-matrix";
import { departmentDashboardStorageContext } from "@/lib/dashboards/dashboard-permissions";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";
import { UI } from "@/styles/ui";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const ALLOWED = new Set<string>(PERMISSION_MATRIX_DEPARTMENTS);

export default function DepartmentDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const department = String(params.department ?? "").toLowerCase();
  const [ready, setReady] = useState(false);

  const storageContext = useMemo(
    () => (ALLOWED.has(department) ? departmentDashboardStorageContext(department) : "operations"),
    [department],
  );

  const onDashboardReady = useCallback((_payload?: OperationalDashboardReadyPayload) => {
    /* homepage welcome overlay not used on department canvases */
  }, []);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      navigateToPulseLogin();
      return;
    }
    if (!ALLOWED.has(department)) {
      router.replace("/settings");
      return;
    }
    const route = `/dashboard/department/${department}`;
    if (isApiMode() && !canAccessClassicNavHref(s, route)) {
      router.replace("/settings");
      return;
    }
    setReady(true);
  }, [department, router]);

  if (!ready || !ALLOWED.has(department)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className={UI.subheader}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="pulse-dashboard-canvas pulse-operations-dashboard space-y-4 px-2 py-4 sm:px-2 sm:py-5">
        <OperationalDashboard
          variant={isApiMode() ? "live" : "demo"}
          dashboardContext={storageContext}
          onReady={onDashboardReady}
        />
      </div>
    </div>
  );
}
