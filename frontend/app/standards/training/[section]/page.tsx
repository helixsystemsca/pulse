import { redirect } from "next/navigation";
import { LEGACY_TRAINING_SECTION_REDIRECTS, TRAINING_ROUTES } from "@/lib/training/routes";

type Props = { params: Promise<{ section: string }> };

export default async function StandardsTrainingSectionLegacyPage({ params }: Props) {
  const { section } = await params;
  redirect(LEGACY_TRAINING_SECTION_REDIRECTS[section] ?? TRAINING_ROUTES.overview);
}
