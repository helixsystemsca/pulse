import { redirect } from "next/navigation";

export const metadata = {
  title: "Compliance · Standards",
  description: "Workforce readiness, training matrix, and compliance visibility.",
};

type Props = { searchParams: Promise<{ tab?: string }> };

export default async function StandardsCompliancePage({ searchParams }: Props) {
  const { tab } = await searchParams;
  if (tab === "archive") {
    redirect("/standards/acknowledgments");
  }
  redirect("/standards/training/compliance#training-matrix");
}
