import { ProcedureAcknowledgmentsArchiveClient } from "@/components/standards/ProcedureAcknowledgmentsArchiveClient";

export const metadata = {
  title: "Procedure acknowledgments",
  description: "Immutable acknowledgment archive for standards and compliance oversight.",
};

export default function StandardsAcknowledgmentsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-ds-foreground">Acknowledgment archive</h1>
      <p className="max-w-3xl text-sm text-ds-muted">
        Audit trail for procedure acknowledgments. Workers see only their own rows; managers, supervisors, and company admins can
        review the full tenant ledger.
      </p>
      <ProcedureAcknowledgmentsArchiveClient />
    </div>
  );
}
