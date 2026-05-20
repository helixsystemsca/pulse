"use client";

import { MapPin, User } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  formatInstructor,
  formatSessionDateRange,
  hasInstructorName,
} from "@/communications/xplor/normalize/brochure-format";
import type { PublicationEntry, PublicationSession } from "@/communications/xplor/schema/publication";

type XplorPreviewCardProps = {
  entry: PublicationEntry;
  index?: number;
  className?: string;
};

function SessionMetadataRow({ session }: { session: PublicationSession }) {
  const dateLine = formatSessionDateRange(session.startDate, session.endDate);
  const hasAny = Boolean(
    session.days?.trim() ||
      session.time?.trim() ||
      dateLine ||
      session.price?.trim() ||
      session.programCode?.trim(),
  );
  if (!hasAny) return null;

  return (
    <div
      className="flex flex-wrap items-baseline gap-x-4 gap-y-0 font-mono text-xs leading-snug text-ds-foreground"
      role="row"
    >
      {session.days ? (
        <span className="shrink-0 whitespace-nowrap" role="cell">
          {session.days}
        </span>
      ) : null}
      {session.time ? (
        <span className="shrink-0 whitespace-nowrap" role="cell">
          {session.time.replace(/-/g, "–")}
        </span>
      ) : null}
      {dateLine ? (
        <span className="shrink-0 whitespace-nowrap" role="cell">
          {dateLine}
        </span>
      ) : null}
      {session.price ? (
        <span className="shrink-0 whitespace-nowrap" role="cell">
          {session.price}
        </span>
      ) : null}
      {session.programCode ? (
        <span className="shrink-0 whitespace-nowrap text-ds-muted" role="cell">
          #{session.programCode}
        </span>
      ) : null}
    </div>
  );
}

export function XplorPreviewCard({ entry, index, className }: XplorPreviewCardProps) {
  const groups = entry.sessionGroups.length
    ? entry.sessionGroups
    : [{ ageGroup: entry.ageRange, sessions: entry.sessions }];

  const instructorName = formatInstructor(entry.instructor);
  const showInstructor = hasInstructorName(entry.instructor);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-ds-border bg-gradient-to-b from-ds-secondary/40 to-ds-primary",
        "shadow-sm",
        className,
      )}
    >
      <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-ds-foreground">
        {entry.ageRange ? (
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--ds-accent)]">{entry.ageRange}</p>
        ) : null}

        <h3 className="font-serif text-lg font-semibold leading-snug text-ds-foreground">
          {entry.title || `Program ${(index ?? 0) + 1}`}
        </h3>

        {entry.confidence < 0.75 ? (
          <p className="text-[10px] text-amber-700 dark:text-amber-200">
            Parser confidence {(entry.confidence * 100).toFixed(0)}%
          </p>
        ) : null}

        {entry.description ? (
          <p className="whitespace-pre-wrap text-ds-foreground/90">{entry.description}</p>
        ) : null}

        {entry.location ? (
          <div className="flex gap-2 text-ds-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-accent)]" aria-hidden />
            <span>{entry.location}</span>
          </div>
        ) : null}

        {showInstructor ? (
          <div className="flex gap-2 text-ds-muted">
            <User className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{instructorName}</span>
          </div>
        ) : null}

        {groups.map((group) => (
          <div key={`${entry.id}-${group.ageGroup}`} className="space-y-2">
            {group.ageGroup && group.ageGroup !== entry.ageRange ? (
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ds-accent)]">{group.ageGroup}</p>
            ) : null}
            {group.sessions.map((session) => (
              <SessionMetadataRow key={session.id} session={session} />
            ))}
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
