import { ComingSoonCard } from "@/components/platform/ComingSoonCard";

const SECTIONS = [
  { title: "Upload", description: "Source files and ingestion targets for municipal communications." },
  { title: "Parsing", description: "Structure detection and content extraction pipeline." },
  { title: "Transformation rules", description: "Configurable mappings from source to house style." },
  { title: "Preview", description: "WYSIWYG and diff views before publishing." },
  { title: "Export", description: "PDF, web, and partner feeds — integrations TBD." },
] as const;

export function PublicationBuilderPlaceholder() {
  return (
    <div className="space-y-6">
      <ComingSoonCard
        title="Publication Builder"
        description="End-to-end authoring for communications teams. Parser, templates, and export wiring will land in a dedicated milestone."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-lg border border-ds-border bg-ds-primary/80 p-4 shadow-[var(--ds-shadow-card)]"
          >
            <h3 className="text-sm font-semibold text-ds-foreground">{s.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-ds-muted">{s.description}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Placeholder</p>
          </div>
        ))}
      </div>
    </div>
  );
}
