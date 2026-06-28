import type { Metadata } from "next";
import { TrainingLearningShell } from "@/components/training/domain/TrainingLearningShell";

export const metadata: Metadata = {
  title: "Courses | Learning | Training | Helix",
};

export default function TrainingLearningCoursesPage() {
  return <TrainingLearningShell section="courses" />;
}
