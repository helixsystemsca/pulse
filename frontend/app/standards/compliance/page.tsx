import { redirect } from "next/navigation";
import { TRAINING_ROUTES } from "@/lib/training/routes";

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function StandardsComplianceLegacyPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  if (tab === "archive") {
    redirect(TRAINING_ROUTES.learningAcknowledgments);
  }
  redirect(`${TRAINING_ROUTES.complianceMatrix}#training-matrix`);
}
