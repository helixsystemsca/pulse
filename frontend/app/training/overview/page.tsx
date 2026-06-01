import type { Metadata } from "next";
import { TrainingOverviewShell } from "@/components/training/domain/TrainingOverviewShell";

export const metadata: Metadata = {
  title: "Overview | Training | Helix",
  description: "Workforce readiness and compliance overview.",
};

export default function TrainingOverviewPage() {
  return <TrainingOverviewShell />;
}
