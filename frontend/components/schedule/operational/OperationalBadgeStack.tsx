"use client";

import { OPERATIONAL_BADGE_REGISTRY } from "@/lib/schedule/operational-scheduling-model";
import { operationalBadgeClasses } from "@/lib/schedule/schedule-semantic-styles";

const MAX_VISIBLE = 3;

export function OperationalBadgeStack({
  codes,
  maxVisible = MAX_VISIBLE,
}: {
  codes: string[];
  maxVisible?: number;
}) {
  const uniq = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (uniq.length === 0) return null;
  const show = uniq.slice(0, maxVisible);
  const overflow = uniq.length - show.length;

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-0.5">
      {show.map((code) => {
        const def = OPERATIONAL_BADGE_REGISTRY[code];
        const label = def?.label ?? code;
        const detail = def?.detail ?? "";
        const group = def?.group ?? "special";
        const tip = detail ? `${code} — ${label}. ${detail}` : `${code} — ${label}`;
        return (
          <span
            key={code}
            title={tip}
            className={`inline-flex max-w-[3.25rem] shrink-0 truncate rounded px-1 py-px text-[9px] font-extrabold uppercase tracking-wide ${operationalBadgeClasses(group)}`}
          >
            {code}
          </span>
        );
      })}
      {overflow > 0 ? (
        <span
          title={uniq.slice(maxVisible).join(", ")}
          className="inline-flex shrink-0 rounded border border-ds-border bg-ds-secondary/80 px-1 py-px text-[9px] font-bold text-ds-muted"
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
