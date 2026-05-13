import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { Campaign } from "@/modules/communications/types";
import { StatusBadge } from "@/components/communications/StatusBadge";

type CampaignCardProps = {
  campaign: Campaign;
  onOpen?: (c: Campaign) => void;
  className?: string;
};

export function CampaignCard({ campaign, onOpen, className }: CampaignCardProps) {
  const range = `${campaign.startDate} → ${campaign.endDate}`;
  return (
    <motion.button
      type="button"
      layout
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => onOpen?.(campaign)}
      className={cn(
        "w-full rounded-2xl border border-ds-border bg-gradient-to-br from-ds-primary to-ds-secondary/30 p-4 text-left shadow-[var(--ds-shadow-card)] transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">{campaign.department}</p>
          <p className="mt-1 truncate text-base font-semibold text-ds-foreground">{campaign.title}</p>
          <p className="mt-1 text-xs text-ds-muted">{range}</p>
        </div>
        <StatusBadge variant="campaign" status={campaign.status} size="md" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {campaign.channels.slice(0, 4).map((ch) => (
          <span
            key={ch}
            className="rounded-full bg-ds-secondary/80 px-2 py-0.5 text-[10px] font-medium text-ds-foreground ring-1 ring-ds-border/60"
          >
            {ch}
          </span>
        ))}
      </div>
    </motion.button>
  );
}
