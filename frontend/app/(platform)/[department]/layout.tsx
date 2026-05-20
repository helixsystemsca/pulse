import { notFound } from "next/navigation";
import { getDepartmentBySlug, isPlatformDepartmentSlug } from "@/config/platform/departments";

/** Legacy `/{department}/…` segment — modules only; no department workspace chrome. */
export default function DepartmentRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { department: string };
}) {
  if (!isPlatformDepartmentSlug(params.department)) notFound();
  if (!getDepartmentBySlug(params.department)) notFound();
  return <>{children}</>;
}
