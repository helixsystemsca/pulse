import { FinanceWorkspace } from "@/features/finance/FinanceWorkspace";

export default function FinancePage({ params }: { params: { slug?: string[] } }) {
  return <FinanceWorkspace slug={params.slug} />;
}
