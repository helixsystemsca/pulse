import { cn } from "@/lib/cn";
import type { AdSlotStatus } from "@/modules/communications/types";
import type { CampaignStatus } from "@/modules/communications/types";

const AD_STATUS_STYLES: Record<AdSlotStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/25",
  reserved: "bg-amber-500/15 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500/25",
  occupied: "bg-sky-500/15 text-sky-900 dark:text-sky-100 ring-1 ring-sky-500/25",
  expired: "bg-ds-muted/40 text-ds-muted ring-1 ring-ds-border",
};

const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, string> = {
  planning: "bg-violet-500/12 text-violet-900 dark:text-violet-100 ring-1 ring-violet-500/20",
  awaiting_assets: "bg-amber-500/12 text-amber-900 dark:text-amber-100 ring-1 ring-amber-500/20",
  design: "bg-sky-500/12 text-sky-900 dark:text-sky-100 ring-1 ring-sky-500/20",
  scheduled: "bg-teal-500/12 text-teal-900 dark:text-teal-100 ring-1 ring-teal-500/20",
  published: "bg-emerald-500/12 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500/20",
};

const AD_LABELS: Record<AdSlotStatus, string> = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  expired: "Expired",
};

const CAMPAIGN_LABELS: Record<CampaignStatus, string> = {
  planning: "Planning",
  awaiting_assets: "Awaiting assets",
  design: "In design",
  scheduled: "Scheduled",
  published: "Published",
};

type StatusBadgeProps = {
  className?: string;
  size?: "sm" | "md";
} & ({ variant: "ad"; status: AdSlotStatus } | { variant: "campaign"; status: CampaignStatus });

export function StatusBadge(props: StatusBadgeProps) {
  const size = props.size ?? "sm";
  const base =
    "inline-flex items-center rounded-full font-semibold capitalize tracking-wide " +
    (size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs");
  if (props.variant === "ad") {
    return (
      <span className={cn(base, AD_STATUS_STYLES[props.status], props.className)}>{AD_LABELS[props.status]}</span>
    );
  }
  return (
    <span className={cn(base, CAMPAIGN_STATUS_STYLES[props.status], props.className)}>
      {CAMPAIGN_LABELS[props.status]}
    </span>
  );
}

/** Heuristic: expiring within 45 days → “Expiring soon” chip for occupied slots. */
export function isExpiringSoon(isoDate: string | undefined): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const diff = d.getTime() - Date.now();
  return diff > 0 && diff < 45 * 24 * 60 * 60 * 1000;
}

export function ExpiringSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-900 ring-1 ring-orange-500/25 dark:text-orange-100",
        className,
      )}
    >
      Expiring soon
    </span>
  );
}
