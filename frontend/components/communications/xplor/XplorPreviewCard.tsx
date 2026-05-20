"use client";

import { MapPin, User } from "lucide-react";
import { cn } from "@/lib/cn";
import type { XplorProgram } from "@/communications/xplor/types";

type XplorPreviewCardProps = {
  program: XplorProgram;
  index?: number;
  className?: string;
};

export function XplorPreviewCard({ program, index, className }: XplorPreviewCardProps) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-ds-border bg-gradient-to-b from-ds-secondary/40 to-ds-primary",
        "shadow-sm",
        className,
      )}
    >
      <header className="border-b border-ds-border/80 bg-ds-secondary/50 px-4 py-3">
        {program.age ? (
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ds-accent)]">{program.age}</p>
        ) : null}
        <h3 className="mt-1 font-serif text-lg font-semibold leading-snug text-ds-foreground">
          {program.title || `Program ${(index ?? 0) + 1}`}
        </h3>
      </header>

      <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-ds-foreground">
        {program.description ? (
          <p className="text-ds-foreground/90 whitespace-pre-wrap">{program.description}</p>
        ) : null}

        {program.location ? (
          <div className="flex gap-2 text-ds-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-accent)]" aria-hidden />
            <span>{program.location}</span>
          </div>
        ) : null}

        {program.instructor ? (
          <div className="flex gap-2 text-ds-muted">
            <User className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{program.instructor}</span>
          </div>
        ) : null}

        {program.sessions.length > 0 ? (
          <div className="rounded-lg border border-ds-border/80 bg-ds-secondary/30 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Schedule</p>
            <ul className="mt-1.5 space-y-1 font-mono text-xs text-ds-foreground">
              {program.sessions.map((row, i) => (
                <li key={`${program.id}-session-${i}`}>{row}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {program.extraFees ? (
          <p className="text-xs font-semibold text-ds-foreground">
            <span className="text-ds-muted">Fees: </span>
            {program.extraFees}
          </p>
        ) : null}
      </div>
    </article>
  );
}
