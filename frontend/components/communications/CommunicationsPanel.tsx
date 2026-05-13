import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CommunicationsPanelProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Wider right column on xl screens */
  tone?: "default" | "muted";
};

export function CommunicationsPanel({ title, description, children, className, tone = "default" }: CommunicationsPanelProps) {
  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border border-ds-border shadow-[var(--ds-shadow-card)] transition-shadow duration-200 hover:shadow-md",
        tone === "muted" ? "bg-ds-secondary/40" : "bg-ds-primary/90",
        className,
      )}
    >
      <div className="border-b border-ds-border/80 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-ds-foreground">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-relaxed text-ds-muted">{description}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </aside>
  );
}
