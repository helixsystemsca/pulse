import { notFound } from "next/navigation";
import { getDepartmentBySlug, isPlatformDepartmentSlug } from "@/config/platform/departments";
import { DepartmentWorkspaceAccessGate } from "@/components/platform/DepartmentWorkspaceAccessGate";
import { PlatformDepartmentBanner } from "@/components/platform/PlatformDepartmentBanner";

export default function DepartmentShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { department: string };
}) {
  if (!isPlatformDepartmentSlug(params.department)) notFound();
  if (!getDepartmentBySlug(params.department)) notFound();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PlatformDepartmentBanner />
      <div className="min-h-0 flex-1 px-3 py-4 lg:px-4">
        <DepartmentWorkspaceAccessGate departmentSlug={params.department}>{children}</DepartmentWorkspaceAccessGate>
      </div>
    </div>
  );
}
