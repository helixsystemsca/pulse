import type { Metadata } from "next";
import { TrainingComplianceShell } from "@/components/training/domain/TrainingComplianceShell";

export const metadata: Metadata = {
  title: "Compliance | Training | Panorama",
  description: "Workforce qualification matrix, registry, and expiring credentials.",
};

type Props = { params: Promise<{ section: string }> };

export default async function TrainingComplianceSectionPage({ params }: Props) {
  const { section } = await params;
  return <TrainingComplianceShell section={section} />;
}
