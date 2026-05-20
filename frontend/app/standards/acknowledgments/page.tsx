import { Suspense } from "react";
import { ProcedureAcknowledgmentsArchiveClient } from "@/components/standards/ProcedureAcknowledgmentsArchiveClient";

export const metadata = {
  title: "Acknowledgment archive · Standards",
  description: "Historical procedure training acknowledgments.",
};

export default function StandardsAcknowledgmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ds-muted">Loading archive…</p>}>
      <ProcedureAcknowledgmentsArchiveClient />
    </Suspense>
  );
}
