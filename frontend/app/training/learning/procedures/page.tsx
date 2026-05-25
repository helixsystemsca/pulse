import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function LegacyLearningProceduresPage() {
  redirect(TRAINING_ROUTES.learningLibrary);
}
