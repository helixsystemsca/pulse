"use client";

import { MapPin, User } from "lucide-react";
import { cn } from "@/lib/cn";
import type { PublicationEntry } from "@/communications/xplor/schema/publication";

type XplorPreviewCardProps = {
  entry: PublicationEntry;
  index?: number;
  className?: string;
};

export function XplorPreviewCard({ entry, index, className }: XplorPreviewCardProps) {
  const groups = entry.sessionGroups.length
    ? entry.sessionGroups
    : [{ ageGroup: entry.ageRange, sessions: entry.sessions }];

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-ds-border bg-gradient-to-b from-ds-secondary/40 to-ds-primary",
        "shadow-sm",
        className,
      )}
    >
      <header className="border-b border-ds-border/80 bg-ds-secondary/50 px-4 py-3">
        {entry.ageRange ? (
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ds-accent)]">{entry.ageRange}</p>
        ) : null}
        <h3 className="mt-1 font-serif text-lg font-semibold leading-snug text-ds-foreground">
          {entry.title || `Program ${(index ?? 0) + 1}`}
        </h3>
        {entry.confidence < 0.75 ? (
          <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-200">
            Parser confidence {(entry.confidence * 100).toFixed(0)}%
          </p>
        ) : null}
      </header>

      <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-ds-foreground">
        {entry.description ? (
          <p className="whitespace-pre-wrap text-ds-foreground/90">{entry.description}</p>
        ) : null}

        {entry.location ? (
          <div className="flex gap-2 text-ds-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-accent)]" aria-hidden />
            <span>{entry.location}</span>
          </div>
        ) : null}

        {entry.instructor ? (
          <div className="flex gap-2 text-ds-muted">
            <User className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{entry.instructor}</span>
          </div>
        ) : null}

        {groups.map((group) => (
          <div
            key={`${entry.id}-${group.ageGroup}`}
            className="rounded-lg border border-ds-border/80 bg-ds-secondary/30 px-3 py-2"
          >
            {group.ageGroup ? (
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ds-accent)]">{group.ageGroup}</p>
            ) : null}
            <ul className="mt-1.5 space-y-2 font-mono text-xs text-ds-foreground">
              {group.sessions.map((session) => (
                <li key={session.id} className="rounded border border-ds-border/60 bg-ds-primary/50 px-2 py-1.5">
                  <span className="font-sans text-[10px] font-bold text-ds-muted">{session.sessionLabel}</span>
                  <div className="mt-0.5 grid gap-0.5">
                    {session.days ? <span>{session.days}</span> : null}
                    {session.time ? <span>{session.time}</span> : null}
                    {(session.startDate || session.endDate) && (
                      <span>
                        {session.startDate}
                        {session.endDate && session.endDate !== session.startDate
                          ? ` – ${session.endDate}`
                          : ""}
                      </span>
                    )}
                    {session.price ? <span>{session.price}</span> : null}
                    {session.programCode ? (
                      <span className="text-ds-muted">#{session.programCode}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {entry.extraFees ? (
          <p className="text-xs font-semibold text-ds-foreground">
            <span className="text-ds-muted">Fees: </span>
            {entry.extraFees}
          </p>
        ) : null}
      </div>
    </article>
  );
}
