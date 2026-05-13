"use client";

/**
 * Publication pipeline (Xplor → InDesign) — UI scaffold only.
 *
 * Future backend integration (keep contracts stable):
 * - POST /api/communications/publications/ingest — multipart upload, virus scan, storage keys
 * - POST /api/communications/publications/:id/parse — async job, structured AST + provenance
 * - PATCH /api/communications/publications/:id/rules — persisted transform DAG (order + params)
 * - GET  /api/communications/publications/:id/preview — cached HTML / tagged text fragments
 * - POST /api/communications/publications/:id/export — worker queue (InDesign tagged text, DOCX, XML, JSON)
 * - GET  /api/communications/publications/:id/versions — immutable artifacts + semver
 */

import { useCallback, useState } from "react";
import { FileDown, UploadCloud } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { CommunicationsModuleShell } from "@/components/communications/CommunicationsModuleShell";
import { RuleBuilderCard } from "@/components/communications/RuleBuilderCard";
import { SplitPreviewLayout } from "@/components/communications/SplitPreviewLayout";
import { WorkflowStepper } from "@/components/communications/WorkflowStepper";
import type { WorkflowStep } from "@/components/communications/WorkflowStepper";
import { cn } from "@/lib/cn";
import type {
  PublicationExportFormat,
  PublicationTemplate,
  PublicationTemplateId,
  PublicationTransformRule,
  PublicationUploadFile,
  PublicationWorkflowStageId,
} from "@/modules/communications/types";

const STEPS: WorkflowStep[] = [
  { id: "upload", label: "Upload", hint: "Source files" },
  { id: "parse", label: "Parse", hint: "Structure map" },
  { id: "transform", label: "Transform", hint: "House rules" },
  { id: "preview", label: "Preview", hint: "WYSIWYG" },
  { id: "export", label: "Export", hint: "Handoff" },
];

const TEMPLATES: PublicationTemplate[] = [
  {
    id: "seasonal_recreation",
    name: "Seasonal Recreation Guide",
    description: "Program grid + feature stories + facility map slots.",
  },
  { id: "aquatics_guide", name: "Aquatics Guide", description: "Lesson tables, safety copy blocks, instructor roster." },
  { id: "fitness_brochure", name: "Fitness Brochure", description: "Class cards, pricing tiers, CTA strips." },
  { id: "event_flyer", name: "Event Flyer", description: "Single-focus hero, sponsors strip, tear-line optional." },
];

const INITIAL_RULES: PublicationTransformRule[] = [
  { id: "r1", type: "remove_field", label: "Strip internal metadata", detail: "Xplor export fields not for print.", enabled: true },
  { id: "r2", type: "rename_field", label: "Normalize headings", detail: "H1 → Title style mapping.", enabled: true },
  { id: "r3", type: "reorder", label: "Move pricing after hero", detail: "Template-specific ordering.", enabled: false },
  { id: "r4", type: "apply_style", label: "Aquatics body style", detail: "Paragraph style preset pack.", enabled: true },
  { id: "r5", type: "group_sections", label: "Group lessons by age", detail: "Creates section anchors for InDesign.", enabled: false },
];

const MOCK_RAW = `XPLOR_EXPORT (mock)
-------------------
[HEADER] facility=Municipal Arena | season=Summer 2026
[SECTION] programs
  [ROW] id=101 title="Youth Swim" age=6-12 weeks=8
  [ROW] id=102 title="Masters" age=18+ weeks=10
[SECTION] notices
  [BLOCK] type=closure date=2026-05-12 text="Ice maintenance"`;

const MOCK_PREVIEW = (
  <article className="space-y-3 text-sm leading-relaxed text-ds-foreground">
    <header>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Seasonal Recreation Guide</p>
      <h2 className="text-lg font-bold">Summer at the arena</h2>
    </header>
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Programs</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-ds-muted">
        <li>
          <span className="text-ds-foreground">Youth Swim</span> — ages 6–12 · 8 weeks
        </li>
        <li>
          <span className="text-ds-foreground">Masters</span> — 18+ · 10 weeks
        </li>
      </ul>
    </section>
    <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-950 dark:text-amber-100">
      <strong>Notice:</strong> Ice maintenance 12 May — reduced public skate.
    </section>
  </article>
);

const ACCEPT = ".rtf,.txt,.docx,.csv,text/plain,application/rtf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv";

export function PublicationBuilderPage() {
  const [stage, setStage] = useState<PublicationWorkflowStageId>("upload");
  const [files, setFiles] = useState<PublicationUploadFile[]>([]);
  const [rules, setRules] = useState<PublicationTransformRule[]>(INITIAL_RULES);
  const [templateId, setTemplateId] = useState<PublicationTemplateId>("seasonal_recreation");
  const [exports, setExports] = useState<Record<PublicationExportFormat, boolean>>({
    indesign_tagged: true,
    docx: false,
    xml: false,
    json: true,
  });

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files ?? []);
    if (!list.length) return;
    const next: PublicationUploadFile[] = list.map((f, i) => ({
      id: `up-${Date.now()}-${i}`,
      name: f.name,
      sizeLabel: `${(f.size / 1024).toFixed(1)} KB`,
      status: "ready" as const,
      detectedFormat: f.name.split(".").pop()?.toUpperCase() ?? "—",
    }));
    setFiles((prev) => [...next, ...prev]);
  }, []);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (!list.length) return;
    const next: PublicationUploadFile[] = list.map((f, i) => ({
      id: `up-${Date.now()}-${i}`,
      name: f.name,
      sizeLabel: `${(f.size / 1024).toFixed(1)} KB`,
      status: "ready",
      detectedFormat: f.name.split(".").pop()?.toUpperCase() ?? "—",
    }));
    setFiles((prev) => [...next, ...prev]);
  }, []);

  const toggleRule = useCallback((id: string, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  }, []);

  const toggleExport = useCallback((k: PublicationExportFormat) => {
    setExports((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  return (
    <CommunicationsModuleShell
      title="Xplor → InDesign publication pipeline"
      description="Operational workflow for ingesting exports, applying house transform rules, previewing publication structure, and generating handoff artifacts."
    >
      <Card className="p-4 sm:p-6">
        <WorkflowStepper steps={STEPS} activeId={stage} onSelect={setStage} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <AnimatePresence mode="wait">
          <motion.section
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="lg:col-span-3"
          >
            {stage === "upload" ? (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-ds-foreground">Upload source files</h2>
                <p className="mt-1 text-xs text-ds-muted">RTF, TXT, DOCX, CSV — server-side parsing hooks later.</p>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className={cn(
                    "mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ds-border bg-ds-secondary/20 px-4 py-8 text-center transition-colors hover:border-[var(--ds-accent)]/40 hover:bg-ds-secondary/35",
                  )}
                >
                  <UploadCloud className="h-10 w-10 text-ds-muted" strokeWidth={1.25} aria-hidden />
                  <p className="mt-3 text-sm font-medium text-ds-foreground">Drop files here</p>
                  <p className="mt-1 text-xs text-ds-muted">or choose from your computer</p>
                  <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                    Browse
                    <input type="file" className="sr-only" multiple accept={ACCEPT} onChange={onFileInput} />
                  </label>
                </div>
                {files.length ? (
                  <ul className="mt-4 space-y-2">
                    {files.map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-ds-foreground">{f.name}</span>
                        <span className="text-xs text-ds-muted">
                          {f.sizeLabel} · {f.status} · format {f.detectedFormat}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-xs text-ds-muted">No files yet — uploads will enqueue ingestion jobs on the API.</p>
                )}
              </Card>
            ) : null}

            {stage === "parse" ? (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-ds-foreground">Parsing preview</h2>
                <p className="mt-1 text-xs text-ds-muted">Side-by-side diff between raw export and normalized structure.</p>
                <div className="mt-4">
                  <SplitPreviewLayout
                    leftTitle="Raw imported structure"
                    rightTitle="Formatted publication preview"
                    left={<pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ds-muted">{MOCK_RAW}</pre>}
                    right={MOCK_PREVIEW}
                  />
                </div>
              </Card>
            ) : null}

            {stage === "transform" ? (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-ds-foreground">Transformation rules</h2>
                <p className="mt-1 text-xs text-ds-muted">Visual rule builder — persisted as ordered steps for the transform engine.</p>
                <div className="mt-4 space-y-3">
                  {rules.map((r) => (
                    <RuleBuilderCard key={r.id} rule={r} onToggle={toggleRule} />
                  ))}
                </div>
              </Card>
            ) : null}

            {stage === "preview" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-5">
                  <h2 className="text-sm font-semibold text-ds-foreground">Template</h2>
                  <p className="mt-1 text-xs text-ds-muted">Select a house template — drives style tokens and section skeleton.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-all hover:shadow-md",
                          templateId === t.id
                            ? "border-[var(--ds-accent)] bg-[var(--ds-accent)]/8 ring-2 ring-[var(--ds-accent)]/20"
                            : "border-ds-border bg-ds-secondary/25",
                        )}
                      >
                        <p className="text-sm font-semibold text-ds-foreground">{t.name}</p>
                        <p className="mt-1 text-xs text-ds-muted">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <h2 className="text-sm font-semibold text-ds-foreground">Layout preview</h2>
                  <p className="mt-1 text-xs text-ds-muted">Placeholder spread — live preview will bind to parser output + template.</p>
                  <div className="mt-4 grid min-h-[220px] grid-cols-2 gap-2 rounded-xl border border-ds-border bg-gradient-to-br from-ds-secondary/40 to-ds-primary p-3">
                    <div className="rounded-lg bg-ds-primary/80 p-2 text-[10px] text-ds-muted shadow-sm">Cover / hero</div>
                    <div className="rounded-lg bg-ds-primary/80 p-2 text-[10px] text-ds-muted shadow-sm">TOC</div>
                    <div className="col-span-2 rounded-lg bg-ds-primary/80 p-2 text-[10px] text-ds-muted shadow-sm">Body grid</div>
                  </div>
                </Card>
              </div>
            ) : null}

            {stage === "export" ? (
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-ds-foreground">Export</h2>
                <p className="mt-1 text-xs text-ds-muted">Choose handoff formats — workers will materialize bytes + checksums.</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    {(
                      [
                        ["indesign_tagged", "InDesign tagged text"],
                        ["docx", "DOCX"],
                        ["xml", "XML"],
                        ["json", "JSON"],
                      ] as const
                    ).map(([k, label]) => (
                      <label
                        key={k}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-ds-border bg-ds-secondary/20 px-3 py-2.5 text-sm hover:bg-ds-secondary/35"
                      >
                        <input type="checkbox" className="h-4 w-4" checked={exports[k]} onChange={() => toggleExport(k)} />
                        <span className="font-medium text-ds-foreground">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="rounded-xl border border-ds-border bg-ds-secondary/20 p-4 text-xs text-ds-muted">
                    <p className="font-semibold text-ds-foreground">Export settings (placeholders)</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      <li>Embed fonts policy (TBD)</li>
                      <li>Color space: RGB vs CMYK (TBD)</li>
                      <li>Version label: v0.3-draft</li>
                      <li>Retention: 90 days on bucket `pub-exports`</li>
                    </ul>
                    <button
                      type="button"
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--ds-accent)] px-4 py-2 text-sm font-semibold text-white opacity-80 hover:opacity-100"
                    >
                      <FileDown className="h-4 w-4" aria-hidden />
                      Queue export (disabled)
                    </button>
                  </div>
                </div>
              </Card>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </div>
    </CommunicationsModuleShell>
  );
}
