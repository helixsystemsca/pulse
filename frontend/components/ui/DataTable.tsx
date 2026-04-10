import type { ReactNode } from "react";
import { Card } from "@/components/pulse/Card";

/** Wrapper for list/table surfaces — secondary card, no inner padding (use table px/py). */
export function DataTableCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Card variant="secondary" padding="none" className={`overflow-hidden ${className}`}>
      {children}
    </Card>
  );
}

export const dataTableHeadRowClass =
  "border-b border-ds-border bg-ds-primary text-left text-xs font-bold uppercase tracking-wide text-ds-muted";

/** Base body row — combine with optional emphasis classes from the feature. */
export function dataTableBodyRow(extra = ""): string {
  return `ds-table-row-hover bg-ds-secondary border-b border-ds-border/70 last:border-0 ${extra}`.trim();
}
