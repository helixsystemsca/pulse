import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function TrainingRootPage() {
  redirect(TRAINING_ROUTES.overview);
}
