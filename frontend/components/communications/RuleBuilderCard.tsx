import { GripVertical } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { PublicationRuleType, PublicationTransformRule } from "@/modules/communications/types";

const RULE_LABELS: Record<PublicationRuleType, string> = {
  remove_field: "Remove field",
  rename_field: "Rename field",
  reorder: "Reorder content",
  apply_style: "Apply style",
  group_sections: "Group sections",
};

type RuleBuilderCardProps = {
  rule: PublicationTransformRule;
  onToggle?: (id: string, enabled: boolean) => void;
  className?: string;
};

export function RuleBuilderCard({ rule, onToggle, className }: RuleBuilderCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3 rounded-xl border border-ds-border bg-ds-primary/90 p-3 shadow-sm transition-shadow hover:shadow-md",
        !rule.enabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        className="mt-0.5 text-ds-muted hover:text-ds-foreground"
        aria-label="Reorder rule (preview)"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-ds-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ds-muted">
            {RULE_LABELS[rule.type]}
          </span>
          <span className="text-sm font-semibold text-ds-foreground">{rule.label}</span>
        </div>
        {rule.detail ? <p className="mt-1 text-xs text-ds-muted">{rule.detail}</p> : null}
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-ds-foreground">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => onToggle?.(rule.id, e.target.checked)}
          className="h-4 w-4 rounded border-ds-border"
        />
        On
      </label>
    </motion.div>
  );
}
