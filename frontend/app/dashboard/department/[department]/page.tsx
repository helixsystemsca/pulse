"use client";

import {
  OperationalDashboard,
  type OperationalDashboardReadyPayload,
} from "@/components/dashboard/OperationalDashboard";
import { departmentDashboardStorageContext } from "@/lib/dashboards/dashboard-permissions";
import { isApiMode } from "@/lib/api";
import { navigateToPulseLogin } from "@/lib/pulse-app";
import { readSession } from "@/lib/pulse-session";
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";
import {
  fetchTenantDepartments,
  isAllowedDepartmentSlug,
  type TenantDepartmentRow,
} from "@/lib/tenantDepartmentsService";
import { UI } from "@/styles/ui";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function DepartmentDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const department = String(params.department ?? "").toLowerCase();
  const [tenantDepartments, setTenantDepartments] = useState<TenantDepartmentRow[]>([]);
  const [deptsLoaded, setDeptsLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  const departmentAllowed = useMemo(
    () => isAllowedDepartmentSlug(department, tenantDepartments),
    [department, tenantDepartments],
  );

  const storageContext = useMemo(
    () => (departmentAllowed ? departmentDashboardStorageContext(department) : "operations"),
    [department, departmentAllowed],
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
    let cancelled = false;
    void fetchTenantDepartments(s.company_id ?? null)
      .then((items) => {
        if (!cancelled) setTenantDepartments(items);
      })
      .catch(() => {
        if (!cancelled) setTenantDepartments([]);
      })
      .finally(() => {
        if (!cancelled) setDeptsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deptsLoaded) return;
    const s = readSession();
    if (!s) return;
    if (!departmentAllowed) {
      router.replace("/settings");
      return;
    }
    const route = `/dashboard/department/${department}`;
    if (isApiMode() && !canAccessClassicNavHref(s, route)) {
      router.replace("/settings");
      return;
    }
    setReady(true);
  }, [department, router, deptsLoaded, departmentAllowed]);

  if (!ready || !departmentAllowed) {
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
