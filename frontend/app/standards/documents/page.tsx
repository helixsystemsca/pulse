import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documents | Standards | Panorama",
  description: "Facility standards documents — drawings, references, and operational knowledge.",
};

export default function StandardsDocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ds-border bg-ds-primary/80 p-4 shadow-[var(--ds-shadow-card)] sm:p-5">
        <h2 className="text-base font-semibold text-ds-foreground">Facility documents</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ds-muted">
          Blueprints, manuals, and engineering references live alongside procedures and training. Use the links below for
          common operational libraries.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="rounded-xl border border-ds-border bg-ds-secondary/40 p-4">
          <p className="text-sm font-semibold text-ds-foreground">Drawings & plans</p>
          <p className="mt-1 text-xs text-ds-muted">Floor plans, process diagrams, and redlines.</p>
          <Link href="/drawings" className="ds-link mt-3 inline-block text-sm font-semibold">
            Open drawings →
          </Link>
        </li>
        <li className="rounded-xl border border-ds-border bg-ds-secondary/40 p-4">
          <p className="text-sm font-semibold text-ds-foreground">Step-by-step procedures</p>
          <p className="mt-1 text-xs text-ds-muted">Controlled SOPs and safe work instructions.</p>
          <Link href="/standards/procedures" className="ds-link mt-3 inline-block text-sm font-semibold">
            Open procedures →
          </Link>
        </li>
      </ul>

      <p className="text-xs text-ds-muted">
        Shift and checklist routines remain available at{" "}
        <Link href="/standards/routines" className="ds-link font-semibold">
          /standards/routines
        </Link>
        .
      </p>
    </div>
  );
}
