"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect } from "react";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";
import { readSession } from "@/lib/pulse-session";
import { firstAccessibleClassicTenantHref } from "@/lib/rbac/session-access";

/** Department index URLs are retired — send users to the unified tenant home. */
export default function DepartmentIndexPage({ params }: { params: { department: string } }) {
  const router = useRouter();
  const slug = params.department;

  useEffect(() => {
    if (!isPlatformDepartmentSlug(slug)) return;
    router.replace(firstAccessibleClassicTenantHref(readSession()));
  }, [slug, router]);

  if (!isPlatformDepartmentSlug(slug)) notFound();

  return (
    <div className="flex min-h-[30vh] items-center justify-center text-sm text-ds-muted">
      Redirecting…
    </div>
  );
}
