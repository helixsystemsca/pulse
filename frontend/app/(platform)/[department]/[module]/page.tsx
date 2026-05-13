import { notFound, redirect } from "next/navigation";
import { getDepartmentBySlug, isPlatformDepartmentSlug } from "@/config/platform/departments";
import { getPlatformModuleByDepartmentRoute } from "@/config/platform/modules";
import { ComingSoonCard } from "@/components/platform/ComingSoonCard";
import { PublicationBuilderPlaceholder } from "@/components/platform/PublicationBuilderPlaceholder";
import type { Metadata } from "next";

type PageProps = { params: { department: string; module: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const dept = getDepartmentBySlug(params.department);
  const mod = getPlatformModuleByDepartmentRoute(params.department, params.module);
  if (!dept || !mod) return { title: "Module" };
  return { title: `${mod.name} · ${dept.name}` };
}

export default function PlatformModulePage({ params }: PageProps) {
  const { department: dSlug, module: mRoute } = params;
  if (!isPlatformDepartmentSlug(dSlug)) notFound();
  const dept = getDepartmentBySlug(dSlug);
  const mod = getPlatformModuleByDepartmentRoute(dSlug, mRoute);
  if (!dept || !mod) notFound();
  if (!dept.enabledModuleIds.includes(mod.id)) notFound();

  const canon = mod.canonicalPulseHref;
  const suppress = mod.suppressCanonicalForDepartments?.includes(dSlug) ?? false;
  if (canon && !suppress) redirect(canon);

  if (mod.id === "mod_publication_builder") {
    return <PublicationBuilderPlaceholder />;
  }

  return (
    <ComingSoonCard
      title={mod.name}
      description={`${dept.name} · ${mod.name} will connect to live operational data in a future iteration. Use classic navigation for production workflows today.`}
    />
  );
}
