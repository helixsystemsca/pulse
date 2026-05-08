import type { Metadata } from "next";
import { TrainingOverviewApp } from "@/components/training/TrainingOverviewApp";

export const metadata: Metadata = {
  title: "Training | Standards | Panorama",
  description: "Workforce training and compliance matrix — onboarding, certifications, and acknowledgements.",
};

export default function StandardsTrainingPage() {
  return <TrainingOverviewApp />;
}
