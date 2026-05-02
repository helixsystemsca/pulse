"use client";

/** Top date strip for Gantt / resource views — horizontal scroll peer. */
export function TimelineGrid({
  days,
  pxPerDay,
  projectStart,
}: {
  days: number;
  pxPerDay: number;
  projectStart: Date;
}) {
  const totalPx = days * pxPerDay;
  const cells = Array.from({ length: days }, (_, i) => {
    const d = new Date(projectStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div
      className="flex h-9 shrink-0 border-b border-[var(--ds-border)] bg-[var(--ds-header)] text-[10px] font-semibold text-[var(--pm-color-muted)]"
      style={{ width: totalPx, minWidth: totalPx }}
    >
      {cells.map((d, i) => (
        <div
          key={i}
          className="flex shrink-0 items-center justify-center border-r border-[var(--ds-chart-grid)]"
          style={{ width: pxPerDay, minWidth: pxPerDay }}
        >
          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
      ))}
    </div>
  );
}
