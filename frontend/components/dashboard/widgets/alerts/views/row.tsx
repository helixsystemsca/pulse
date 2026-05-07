import { AlertCircle, AlertTriangle, Info, Minus, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import { NO_ADDITIONAL_ALERTS_TITLE } from "@/components/dashboard/widgets/alerts/AlertsWidget";
import type { AlertsWidgetAlert } from "@/components/dashboard/widgets/alerts/AlertsWidget";

type Priority = "critical" | "high" | "medium" | "low";

function priority(a: AlertsWidgetAlert): Priority {
  if (a.priority) return a.priority;
  return a.severity === "critical" ? "critical" : "medium";
}

export function ActiveAlertRow({ alert: a, compact = false }: { alert: AlertsWidgetAlert; compact?: boolean }) {
  const p = priority(a);
  const isPad = a.countsTowardTotals === false && a.title === NO_ADDITIONAL_ALERTS_TITLE;

  const icon =
    p === "critical" ? (
      <AlertTriangle className="h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
    ) : p === "high" ? (
      <AlertCircle className="h-4 w-4 shrink-0 text-ds-warning" aria-hidden />
    ) : p === "medium" ? (
      <Info className="h-4 w-4 shrink-0 text-[var(--ds-info)]" aria-hidden />
    ) : isPad ? (
      <Minus className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
    ) : (
      <Radio className="h-4 w-4 shrink-0 text-ds-muted" aria-hidden />
    );

  const strip =
    p === "critical"
      ? "border-l-[var(--ds-danger)]"
      : p === "high"
        ? "border-l-ds-warning"
        : p === "medium"
          ? "border-l-[var(--ds-info)]"
          : "border-l-ds-border";

  return (
    <li
      className={cn(
        "flex gap-2 rounded-xl border border-ds-border bg-ds-secondary/15",
        strip,
        "border-l-[3px]",
        compact ? "py-2 pl-2 pr-2" : "py-2.5 pl-2.5 pr-2.5",
        !isPad && p === "critical" && "bg-[color-mix(in_srgb,var(--ds-danger)_7%,transparent)]",
        !isPad && p === "high" && "bg-[color-mix(in_srgb,var(--ds-warning)_8%,transparent)]",
        isPad && "opacity-80",
      )}
      style={
        p === "medium"
          ? ({
              borderLeftColor: "var(--ds-info)",
              background: "color-mix(in srgb, var(--ds-info) 10%, var(--ds-bg))",
            } as const)
          : undefined
      }
    >
      <span className={cn("shrink-0", compact ? "pt-0.5" : "pt-0.5")}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-extrabold leading-snug", compact ? "text-xs" : "text-xs sm:text-sm", isPad ? "text-ds-muted" : "text-ds-foreground")}>
          {a.title}
        </p>
        {!compact && a.subtitle ? (
          <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11px] leading-relaxed text-ds-muted">{a.subtitle}</p>
        ) : null}
      </div>
    </li>
  );
}

