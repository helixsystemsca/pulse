"use client";

import type { WorkforceTimeOffEntry } from "@/lib/dashboard/workforce-time-off";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { cn } from "@/lib/cn";

function TimeOffAvatar({ entry }: { entry: WorkforceTimeOffEntry }) {
  const resolvedSrc = useResolvedAvatarSrc(entry.avatar_url ?? null);

  return (
    <span
      className={cn(
        "relative mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
        "ops-workforce-avatar ops-workforce-avatar--time-off",
        !resolvedSrc && "text-[color-mix(in_srgb,var(--ds-text-primary)_82%,transparent)]",
      )}
    >
      {resolvedSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc}
          alt=""
          className="h-full w-full rounded-full object-cover object-center"
        />
      ) : (
        entry.initials
      )}
    </span>
  );
}

function TimeOffBubble({ entry }: { entry: WorkforceTimeOffEntry }) {
  const label = `${entry.displayName} — ${entry.dateLabel}`;

  return (
    <li
      className="flex w-auto max-w-[6.75rem] min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 py-0.5"
      title={label}
      aria-label={label}
    >
      <TimeOffAvatar entry={entry} />
      <span className="w-full max-w-full truncate px-0.5 text-center text-[10px] font-semibold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
        {entry.displayName}
      </span>
      <span className="line-clamp-2 w-full max-w-full px-0.5 text-center text-[9px] leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
        {entry.dateLabel}
      </span>
    </li>
  );
}

export function WorkforceTimeOffMonth({ entries }: { entries: WorkforceTimeOffEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-auto shrink-0 border-t border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] pt-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
        Time-off this Month
      </p>
      <ul
        className="mt-1 flex min-h-0 w-full max-w-full flex-nowrap items-start justify-start gap-x-1 overflow-x-auto overflow-y-visible pb-0.5 pt-0.5"
        aria-label="Time-off this month"
      >
        {entries.map((entry) => (
          <TimeOffBubble key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
