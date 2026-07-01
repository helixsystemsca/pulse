import type { ReactNode } from "react";
import { dsLabelClass } from "@/components/ui/ds-form-classes";

export function ProfileFieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className={dsLabelClass}>{label}</dt>
      <dd className="mt-1 text-sm text-ds-foreground">{value ?? "—"}</dd>
    </div>
  );
}

export function ProfileStatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-ds-border/60 bg-ds-secondary/30 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ds-foreground">{value}</p>
    </div>
  );
}
