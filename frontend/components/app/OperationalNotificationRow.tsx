"use client";

import Link from "next/link";
import { AlertTriangle, Bell, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  notificationTone,
  operationalNotificationHref,
  type OperationalNotificationItem,
} from "@/lib/dashboard/operational-notifications";

type Props = {
  a: OperationalNotificationItem;
  onNavigate?: () => void;
  onDismiss: (id: string) => void;
};

export function OperationalNotificationRow({ a, onNavigate, onDismiss }: Props) {
  const t = notificationTone(a);
  const href = operationalNotificationHref(a);
  const shell = cn(
    "flex items-start gap-1 rounded-lg border px-2.5 py-2 text-xs transition-colors",
    t === "critical" &&
      "border-[color-mix(in_srgb,var(--ds-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)]",
    t === "warn" &&
      "border-[color-mix(in_srgb,var(--ds-warning)_38%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_10%,transparent)]",
    t === "info" && "border-ds-border/60 bg-ds-secondary/40 dark:bg-ds-secondary/55",
  );
  const linkTone =
    t === "critical"
      ? "hover:bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)]"
      : t === "warn"
        ? "hover:bg-[color-mix(in_srgb,var(--ds-warning)_14%,transparent)]"
        : "hover:bg-ds-secondary/70 dark:hover:bg-ds-secondary/55";
  return (
    <li>
      <div className={shell}>
        <Link
          href={href}
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2 rounded-md no-underline outline-none ring-offset-2 ring-offset-ds-elevated transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)]",
            linkTone,
          )}
          onClick={onNavigate}
        >
          {t === "critical" ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ds-danger)]" aria-hidden />
          ) : (
            <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ds-muted" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-snug text-ds-foreground">{a.title}</p>
            {a.subtitle ? (
              <p className="mt-0.5 whitespace-pre-line text-[11px] leading-relaxed text-ds-muted">{a.subtitle}</p>
            ) : null}
          </div>
        </Link>
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded-md p-0.5 text-ds-muted transition-colors hover:bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] hover:text-ds-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ds-accent)]"
          aria-label={`Dismiss “${a.title}”`}
          onClick={() => onDismiss(a.id)}
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </li>
  );
}
