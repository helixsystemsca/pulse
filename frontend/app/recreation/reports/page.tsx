"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Printer } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  BINDER_SECTION_LABELS,
  downloadBinderPdf,
  downloadStandalonePdf,
  fetchReportsCatalog,
  listChecklists,
  type OpsChecklistInstance,
} from "@/lib/recreation/commandService";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm hover:bg-ds-card disabled:opacity-50";

const STANDALONE: { type: string; label: string; description: string }[] = [
  {
    type: "profile",
    label: "My Profile & Role",
    description: "Professional profile, philosophy, principles, responsibilities, authority.",
  },
  {
    type: "org_chart",
    label: "Org Chart",
    description: "Operational hierarchy from the People directory.",
  },
  {
    type: "attention",
    label: "Operational Attention",
    description: "Cross-module attention totals and priority items.",
  },
  {
    type: "emergency_card",
    label: "Emergency Card (PDF)",
    description: "Compact readiness snapshot — also available as a printable HTML card.",
  },
  {
    type: "checklist",
    label: "Active Checklist",
    description: "Exports a selected checklist instance (defaults to first active).",
  },
];

export default function ReportsPage() {
  const [sections, setSections] = useState<string[]>(Object.keys(BINDER_SECTION_LABELS));
  const [selected, setSelected] = useState<string[]>(Object.keys(BINDER_SECTION_LABELS));
  const [checklists, setChecklists] = useState<OpsChecklistInstance[]>([]);
  const [checklistId, setChecklistId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchReportsCatalog()
      .then((c) => {
        if (c.binder_sections?.length) {
          setSections(c.binder_sections);
          setSelected(c.binder_sections);
        }
      })
      .catch(() => undefined);
    void listChecklists()
      .then((rows) => {
        setChecklists(rows);
        const active = rows.find((r) => r.status === "active");
        if (active) setChecklistId(active.id);
      })
      .catch(() => undefined);
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  function toggleSection(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Export"
        description="Professional municipal-style PDFs for your personal ops binder, plus standalone reports and printable emergency cards."
        icon={FileText}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <section className="mb-10 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Operations binder</h2>
          <p className="text-sm text-ds-muted">
            Choose sections to include, then download a multi-page PDF binder.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(key)}
                    onChange={() => toggleSection(key)}
                  />
                  {BINDER_SECTION_LABELS[key] ?? key}
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnGhost}
              onClick={() => setSelected([...sections])}
            >
              Select all
            </button>
            <button type="button" className={btnGhost} onClick={() => setSelected([])}>
              Clear
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={!selected.length || busy === "binder"}
              onClick={() => void run("binder", () => downloadBinderPdf(selected))}
            >
              <Download className="h-4 w-4" />
              {busy === "binder" ? "Building…" : "Download binder PDF"}
            </button>
          </div>
        </section>

        <section className="mb-10 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Standalone reports</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STANDALONE.map((r) => (
              <li key={r.type} className="rounded-xl border border-ds-border bg-ds-card p-4">
                <h3 className="font-semibold text-ds-foreground">{r.label}</h3>
                <p className="mt-1 text-sm text-ds-muted">{r.description}</p>
                {r.type === "checklist" ? (
                  <select
                    className="mt-3 w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm"
                    value={checklistId}
                    onChange={(e) => setChecklistId(e.target.value)}
                  >
                    <option value="">Select checklist…</option>
                    {checklists.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.progress_pct}%)
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className={`${btnPrimary} mt-3`}
                  disabled={busy === r.type || (r.type === "checklist" && !checklistId)}
                  onClick={() =>
                    void run(r.type, () =>
                      downloadStandalonePdf(
                        r.type,
                        r.type === "checklist" ? checklistId : undefined,
                      ),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                  {busy === r.type ? "Building…" : "Download PDF"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">Printable emergency card</h2>
          <p className="text-sm text-ds-muted">
            Pocket-style HTML card optimized for <code className="text-xs">window.print</code> — use browser print to PDF or paper.
          </p>
          <Link href="/recreation/reports/emergency-card" className={btnGhost}>
            <Printer className="h-4 w-4" />
            Open emergency print card
          </Link>
        </section>
      </PageBody>
    </div>
  );
}
