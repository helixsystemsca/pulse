import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function StandardsRootPage() {
  redirect(TRAINING_ROUTES.overview);
}
