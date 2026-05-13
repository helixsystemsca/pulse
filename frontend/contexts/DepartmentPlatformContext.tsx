"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDepartmentBySlug, isPlatformDepartmentSlug } from "@/config/platform/departments";
import { getPlatformModuleByDepartmentRoute } from "@/config/platform/modules";
import {
  getFirstNavHrefForDepartment,
  listDepartmentsAllowedForSession,
  writeStoredDepartmentSlug,
} from "@/config/platform/navigation";
import type { Department, PlatformModule } from "@/config/platform/types";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { userMayAccessDepartmentWorkspace } from "@/lib/workspace-access";

export type DepartmentPlatformContextValue = {
  department: Department | null;
  activeModule: PlatformModule | null;
  departments: readonly Department[];
  /** Switch department context and navigate to the first visible module for that user. */
  setDepartment: (slug: string) => void;
};

const DepartmentPlatformContext = createContext<DepartmentPlatformContextValue | null>(null);

export function DepartmentPlatformProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = usePulseAuth();
  const segments = pathname.split("/").filter(Boolean);
  const deptSlug = segments[0] ?? null;
  const moduleRoute = segments[1] ?? null;

  const department =
    deptSlug && isPlatformDepartmentSlug(deptSlug) ? getDepartmentBySlug(deptSlug) ?? null : null;

  const activeModule =
    department && moduleRoute
      ? getPlatformModuleByDepartmentRoute(department.slug, moduleRoute) ?? null
      : null;

  useEffect(() => {
    if (department) writeStoredDepartmentSlug(department.slug);
  }, [department]);

  const setDepartment = useCallback(
    (slug: string) => {
      if (!userMayAccessDepartmentWorkspace(session, slug)) return;
      writeStoredDepartmentSlug(slug);
      const href = getFirstNavHrefForDepartment(slug, session);
      if (href) router.push(href);
      else router.push(`/${slug}`);
    },
    [router, session],
  );

  const departments = useMemo(() => listDepartmentsAllowedForSession(session), [session]);

  const value = useMemo<DepartmentPlatformContextValue>(
    () => ({
      department,
      activeModule,
      departments,
      setDepartment,
    }),
    [department, activeModule, departments, setDepartment],
  );

  return <DepartmentPlatformContext.Provider value={value}>{children}</DepartmentPlatformContext.Provider>;
}

export function useDepartmentPlatform(): DepartmentPlatformContextValue {
  const ctx = useContext(DepartmentPlatformContext);
  if (!ctx) {
    throw new Error("useDepartmentPlatform must be used within DepartmentPlatformProvider");
  }
  return ctx;
}

/** Safe variant for chrome that may render outside the provider during static shells. */
export function useDepartmentPlatformOptional(): DepartmentPlatformContextValue | null {
  return useContext(DepartmentPlatformContext);
}
