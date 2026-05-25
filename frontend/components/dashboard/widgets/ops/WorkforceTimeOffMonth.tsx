"use client";

import type { WorkforceTimeOffEntry } from "@/lib/dashboard/workforce-time-off";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";
import { cn } from "@/lib/cn";

function TimeOffAvatar({ entry }: { entry: WorkforceTimeOffEntry }) {
  const resolvedSrc = useResolvedAvatarSrc(entry.avatar_url ?? null);

  return (
    <span
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none",
        "ops-workforce-avatar ops-workforce-avatar--time-off",
        !resolvedSrc && "text-[color-mix(in_srgb,var(--ds-text-primary)_82%,transparent)]",
      )}
      aria-hidden
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

function TimeOffRow({ entry }: { entry: WorkforceTimeOffEntry }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-md py-0.5">
      <TimeOffAvatar entry={entry} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold leading-tight text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
          {entry.displayName}
        </p>
        <p className="text-[9px] leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
          {entry.dateLabel}
        </p>
      </div>
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
        className="mt-1 flex min-h-0 max-h-[8.5rem] flex-col gap-0.5 overflow-y-auto pr-0.5"
        aria-label="Time-off this month"
      >
        {entries.map((entry) => (
          <TimeOffRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
