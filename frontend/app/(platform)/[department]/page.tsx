import { notFound, redirect } from "next/navigation";
import { isPlatformDepartmentSlug } from "@/config/platform/departments";
import { getDefaultModuleRouteForDepartment } from "@/config/platform/navigation";

export default function DepartmentIndexPage({ params }: { params: { department: string } }) {
  if (!isPlatformDepartmentSlug(params.department)) notFound();
  const mod = getDefaultModuleRouteForDepartment(params.department, null);
  if (!mod) notFound();
  redirect(`/${params.department}/${mod}`);
}
