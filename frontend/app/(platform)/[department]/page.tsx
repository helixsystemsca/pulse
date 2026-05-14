"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";
import { getDefaultModuleRouteForDepartment } from "@/config/platform/navigation";
import { readSession } from "@/lib/pulse-session";
import { firstAccessibleClassicTenantHref } from "@/lib/rbac/session-access";

export default function DepartmentIndexPage({ params }: { params: { department: string } }) {
  const router = useRouter();
  const slug = params.department;

  useEffect(() => {
    if (!isPlatformDepartmentSlug(slug)) return;
    const s = readSession();
    const mod = getDefaultModuleRouteForDepartment(slug, s);
    if (mod) {
      router.replace(`/${slug}/${mod}`);
      return;
    }
    router.replace(firstAccessibleClassicTenantHref(s));
  }, [slug, router]);

  if (!isPlatformDepartmentSlug(slug)) notFound();

  return (
    <div className="flex min-h-[30vh] items-center justify-center text-sm text-ds-muted">Redirecting…</div>
  );
}
