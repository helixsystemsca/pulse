import { notFound, redirect } from "next/navigation";
import { getDepartmentBySlug, isPlatformDepartmentSlug } from "@/config/platform/departments";
import { getPlatformModuleByDepartmentRoute } from "@/config/platform/modules";
import { ComingSoonCard } from "@/components/platform/ComingSoonCard";
import { CommunicationsIndesignPipelineTool } from "@/components/platform/communications/CommunicationsIndesignPipelineTool";
import { AdvertisingMapperPage } from "@/modules/communications/advertising-mapper/AdvertisingMapperPage";
import { CampaignPlannerPage } from "@/modules/communications/campaign-planner/CampaignPlannerPage";
import { PublicationBuilderPage } from "@/modules/communications/publication-builder/PublicationBuilderPage";
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

  const canon = mod.canonicalPulseHref;
  const suppress = mod.suppressCanonicalForDepartments?.includes(dSlug) ?? false;
  if (canon && !suppress) redirect(canon);

  if (mod.id === "mod_advertising_mapper") {
    return <AdvertisingMapperPage />;
  }
  if (mod.id === "mod_publication_builder") {
    return <PublicationBuilderPage />;
  }
  if (mod.id === "mod_campaign_planner") {
    return <CampaignPlannerPage />;
  }
  if (mod.id === "mod_indesign_pipeline") {
    return <CommunicationsIndesignPipelineTool />;
  }

  return (
    <ComingSoonCard
      title={mod.name}
      description={`${dept.name} · ${mod.name} will connect to live operational data in a future iteration. Use classic navigation for production workflows today.`}
    />
  );
}
