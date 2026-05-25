import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function LegacyLearningAssignmentsPage() {
  redirect(TRAINING_ROUTES.learningMyLearning);
}
