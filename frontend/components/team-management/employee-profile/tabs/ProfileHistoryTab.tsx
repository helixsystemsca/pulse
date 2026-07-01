"use client";

import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { formatShortDate } from "@/lib/team-management/development-types";

export function ProfileHistoryTab() {
  const { profile } = useEmployeeProfileContext();
  if (!profile) return null;
  const items = [...(profile.development.unified_history ?? [])].sort((a, b) =>
    (b.at || "").localeCompare(a.at || ""),
  );

  return (
    <ul className="space-y-2">
      {items.length === 0 ? (
        <li className="text-sm text-ds-muted">No history yet.</li>
      ) : (
        items.map((h) => (
          <li key={h.id} className="flex gap-3 rounded-lg border border-ds-border/50 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ds-foreground">{h.summary}</p>
              {h.detail ? <p className="mt-0.5 text-xs text-ds-muted">{h.detail}</p> : null}
              <p className="mt-1 text-[10px] uppercase tracking-wide text-ds-muted">{h.kind.replace(/_/g, " ")}</p>
            </div>
            <time className="shrink-0 text-xs tabular-nums text-ds-muted">{formatShortDate(h.at)}</time>
          </li>
        ))
      )}
    </ul>
  );
}
