import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function TrainingComplianceRootPage() {
  redirect(TRAINING_ROUTES.complianceMatrix);
}
