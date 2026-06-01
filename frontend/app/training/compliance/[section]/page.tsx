import type { Metadata } from "next";
import { TrainingComplianceShell } from "@/components/training/domain/TrainingComplianceShell";

export const metadata: Metadata = {
  title: "Compliance | Training | Helix",
  description: "Workforce qualification matrix, registry, and expiring credentials.",
};

type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ panel?: string }>;
};

export default async function TrainingComplianceSectionPage({ params, searchParams }: Props) {
  const { section } = await params;
  const { panel } = await searchParams;
  return <TrainingComplianceShell section={section} panel={panel} />;
}
