"use client";

import { X } from "lucide-react";
import {
  OPERATIONAL_BADGE_REGISTRY,
  operationalBadgeChipLabel,
} from "@/lib/schedule/operational-scheduling-model";
import { operationalBadgeClasses } from "@/lib/schedule/schedule-semantic-styles";

const MAX_VISIBLE = 3;

export function OperationalBadgeStack({
  codes,
  maxVisible = MAX_VISIBLE,
  onRemove,
}: {
  codes: string[];
  maxVisible?: number;
  /** When set, each chip is a button that removes this badge (caller handles persistence). */
  onRemove?: (code: string) => void;
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
        const chipText = operationalBadgeChipLabel(code);
        const tip = detail ? `${code} — ${label}. ${detail}` : `${code} — ${label}`;
        const cls = `inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[9px] font-extrabold uppercase tracking-wide ${operationalBadgeClasses(group)}`;
        if (onRemove) {
          return (
            <button
              key={code}
              type="button"
              title={tip}
              aria-label={`Remove ${label} badge`}
              className={`${cls} cursor-pointer ring-offset-1 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-ring`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove(code);
              }}
            >
              <span>{chipText}</span>
              <X className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
            </button>
          );
        }
        return (
          <span key={code} title={tip} className={cls}>
            {chipText}
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
