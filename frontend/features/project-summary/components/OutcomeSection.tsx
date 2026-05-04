import { Card } from "@/components/pulse/Card";
import type { OutcomeResult, SummaryOutcome } from "../types";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:border-[color-mix(in_srgb,var(--ds-success)_45%,var(--ds-border))] focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";

const OUTCOMES: { value: OutcomeResult; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "partial", label: "Partial" },
  { value: "fail", label: "Did not meet goals" },
];

type Props = {
  value: SummaryOutcome;
  onChange: (next: SummaryOutcome) => void;
  disabled?: boolean;
};

export function OutcomeSection({ value, onChange, disabled }: Props) {
  return (
    <Card padding="md" className="h-full">
      <h2 className="text-sm font-bold text-ds-foreground">Outcome</h2>
      <p className="mt-0.5 text-xs text-ds-muted">Classify the result and capture a short narrative.</p>
      <div className="mt-4 space-y-4">
        <div>
          <label className={LABEL} htmlFor="ps-outcome-result">
            Result
          </label>
          <select
            id="ps-outcome-result"
            className={FIELD}
            disabled={disabled}
            value={value.result}
            onChange={(e) => onChange({ ...value, result: e.target.value as OutcomeResult })}
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="ps-outcome-summary">
            Outcome summary
          </label>
          <textarea
            id="ps-outcome-summary"
            className={FIELD}
            rows={4}
            disabled={disabled}
            value={value.summary}
            onChange={(e) => onChange({ ...value, summary: e.target.value })}
            placeholder="How did this land for the business, stakeholders, and timeline?"
          />
        </div>
      </div>
    </Card>
  );
}
