import type { Metadata } from "next";
import { ProcedureAcknowledgmentRecordClient } from "@/components/standards/ProcedureAcknowledgmentRecordClient";

export const metadata: Metadata = {
  title: "Acknowledgment record",
  description: "Immutable procedure acknowledgment compliance record and PDF.",
};

export default function ProcedureAcknowledgmentRecordPage({
  params,
}: {
  params: { acknowledgmentId: string };
}) {
  return (
    <div className="min-w-0 px-4 py-6">
      <ProcedureAcknowledgmentRecordClient acknowledgmentId={params.acknowledgmentId} />
    </div>
  );
}
