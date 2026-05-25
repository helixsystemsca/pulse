import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function StandardsAcknowledgmentsLegacyPage() {
  redirect(TRAINING_ROUTES.learningAcknowledgments);
}
