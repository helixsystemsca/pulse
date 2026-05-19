import type { Metadata } from "next";
import { WorkforceTrainingShell } from "@/components/standards/workforce-training/WorkforceTrainingShell";

export const metadata: Metadata = {
  title: "Workforce qualifications | Standards | Panorama",
  description: "Operational workforce compliance, certifications, and readiness.",
};

export default function StandardsTrainingPage() {
  return <WorkforceTrainingShell section="overview" />;
}
