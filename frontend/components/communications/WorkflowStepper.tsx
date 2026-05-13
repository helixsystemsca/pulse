import { cn } from "@/lib/cn";
import type { PublicationWorkflowStageId } from "@/modules/communications/types";

export type WorkflowStep = { id: PublicationWorkflowStageId; label: string; hint?: string };

type WorkflowStepperProps = {
  steps: readonly WorkflowStep[];
  activeId: PublicationWorkflowStageId;
  onSelect?: (id: PublicationWorkflowStageId) => void;
  className?: string;
};

export function WorkflowStepper({ steps, activeId, onSelect, className }: WorkflowStepperProps) {
  const activeIndex = Math.max(0, steps.findIndex((s) => s.id === activeId));
  const progress = steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 100;

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex min-w-0 gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const done = i < activeIndex;
          const active = step.id === activeId;
          const clickable = Boolean(onSelect);
          return (
            <button
              key={step.id}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(step.id)}
              className={cn(
                "min-w-[100px] flex-1 rounded-xl border px-2 py-2 text-center transition-colors",
                active && "border-[var(--ds-accent)] bg-[var(--ds-accent)]/10 shadow-sm",
                done && !active && "border-emerald-500/30 bg-emerald-500/5",
                !active && !done && "border-ds-border bg-ds-secondary/30",
                clickable && "hover:border-[var(--ds-accent)]/40",
                !clickable && "cursor-default opacity-90",
              )}
            >
              <p className="text-[10px] font-bold text-ds-muted">Step {i + 1}</p>
              <p className={cn("mt-0.5 text-xs font-semibold", active ? "text-ds-foreground" : "text-ds-muted")}>
                {step.label}
              </p>
              {step.hint ? <p className="mt-1 hidden text-[10px] text-ds-muted sm:block">{step.hint}</p> : null}
            </button>
          );
        })}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ds-border">
        <div
          className="h-full rounded-full bg-[var(--ds-accent)] transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
