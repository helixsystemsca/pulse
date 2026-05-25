import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function StandardsProceduresLegacyPage() {
  redirect(TRAINING_ROUTES.learningProcedures);
}
