import { Suspense } from "react";
import { StandardsComplianceApp } from "@/components/standards/StandardsComplianceApp";

export const metadata = {
  title: "Compliance · Standards",
  description: "Workforce readiness, training matrix, and compliance visibility.",
};

export default function StandardsCompliancePage() {
  return (
    <Suspense fallback={<p className="text-sm text-ds-muted">Loading compliance…</p>}>
      <StandardsComplianceApp />
    </Suspense>
  );
}
