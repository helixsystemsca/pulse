import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

export default function StandardsCertificationsLegacyPage() {
  redirect(`${TRAINING_ROUTES.complianceWorkers}?panel=certifications`);
}
