import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function TrainingLearningRootPage() {
  redirect(TRAINING_ROUTES.learningAssignments);
}
