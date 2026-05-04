import { Card } from "@/components/pulse/Card";
import type { SummaryLessons } from "../types";

const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-ds-border bg-ds-secondary px-3 py-2.5 text-sm text-ds-foreground shadow-sm focus:border-[color-mix(in_srgb,var(--ds-success)_45%,var(--ds-border))] focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)]";

type Props = {
  value: SummaryLessons;
  onChange: (next: SummaryLessons) => void;
  disabled?: boolean;
};

export function LessonsSection({ value, onChange, disabled }: Props) {
  function patch(p: Partial<SummaryLessons>) {
    onChange({ ...value, ...p });
  }
  return (
    <Card padding="md" className="h-full">
      <h2 className="text-sm font-bold text-ds-foreground">Lessons learned</h2>
      <p className="mt-0.5 text-xs text-ds-muted">Your input is saved with the project summary draft.</p>
      <div className="mt-4 space-y-4">
        <div>
          <label className={LABEL} htmlFor="ps-lessons-well">
            What went well
          </label>
          <textarea
            id="ps-lessons-well"
            className={FIELD}
            rows={3}
            disabled={disabled}
            value={value.went_well}
            onChange={(e) => patch({ went_well: e.target.value })}
            placeholder="Highlights, wins, effective practices…"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="ps-lessons-not">
            What didn’t go well
          </label>
          <textarea
            id="ps-lessons-not"
            className={FIELD}
            rows={3}
            disabled={disabled}
            value={value.didnt_go_well}
            onChange={(e) => patch({ didnt_go_well: e.target.value })}
            placeholder="Friction, blockers, surprises…"
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="ps-lessons-improve">
            Improvements for next time
          </label>
          <textarea
            id="ps-lessons-improve"
            className={FIELD}
            rows={3}
            disabled={disabled}
            value={value.improvements}
            onChange={(e) => patch({ improvements: e.target.value })}
            placeholder="Concrete changes you’d make…"
          />
        </div>
      </div>
    </Card>
  );
}
