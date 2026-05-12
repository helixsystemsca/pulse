"use client";

import { formatCertCodesWithLabels } from "@/lib/schedule/certifications";
import type { Shift } from "@/lib/schedule/types";

const orderedCodes = (req: string[]): string[] => {
  const u = new Set(req.map((c) => c.trim().toUpperCase()).filter(Boolean));
  const out: string[] = [];
  const push = (code: string) => {
    if (u.has(code) && !out.includes(code)) out.push(code);
  };
  push("RO");
  push("P1");
  push("P2");
  push("P4");
  push("FA");
  for (const c of u) {
    if (!out.includes(c)) out.push(c);
  }
  return out;
};

type Size = "compact" | "day";

type Props = {
  shift: Shift;
  size?: Size;
  /** If set, use instead of `shift.required_certifications` (e.g. row aggregate). */
  requiredOverride?: string[] | null;
};

/**
 * Replaces the old single “award” cert icon: RO in a ring, pool ops as “PO 1/2”,
 * placed to the **left** of the shift code (caller positions with flex).
 */
export function ScheduleShiftCertChips({ shift, size = "compact", requiredOverride }: Props) {
  const raw = (requiredOverride ?? shift.required_certifications ?? []).filter(Boolean) as string[];
  if (raw.length === 0) return null;

  const codes = orderedCodes(raw);
  if (codes.length === 0) return null;
  const tip = formatCertCodesWithLabels(codes);
  const isSmall = size === "compact";
  const roRing = isSmall
    ? "h-3 w-3 min-h-3 min-w-3 text-[5px] leading-[0.6rem] ring-1 ring-ds-border"
    : "h-3.5 w-3.5 min-h-3.5 min-w-3.5 text-[6px] leading-[0.7rem] ring-1 ring-ds-border";
  const poolCls = isSmall
    ? "px-0.5 text-[5px] leading-tight"
    : "px-0.5 text-[6px] leading-tight";
  const miscCls = isSmall ? "px-0.5 text-[5px] leading-tight" : "px-0.5 text-[6px] leading-tight";

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" title={tip}>
      {codes.map((code) => {
        const c = code.toUpperCase();
        if (c === "RO") {
          return (
            <span
              key="RO"
              className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ds-muted ${roRing}`}
              aria-label="Refrigeration operator"
            >
              RO
            </span>
          );
        }
        if (c === "P1" || c === "P2") {
          return (
            <span
              key={c}
              className={`inline-flex shrink-0 items-center justify-center rounded border border-pulseShell-border bg-pulseShell-elevated/50 font-extrabold text-ds-muted ${poolCls}`}
              aria-label={c === "P1" ? "Pool operator level 1" : "Pool operator level 2"}
            >
              {c === "P1" ? "PO 1" : "PO 2"}
            </span>
          );
        }
        if (c === "P4") {
          return (
            <span
              key="P4"
              className={`inline-flex shrink-0 items-center justify-center rounded border border-pulseShell-border bg-pulseShell-elevated/50 font-extrabold text-ds-muted ${poolCls}`}
              aria-label="4th class power engineer"
            >
              P4
            </span>
          );
        }
        if (c === "FA") {
          return (
            <span
              key="FA"
              className={`inline-flex shrink-0 items-center justify-center rounded border border-pulseShell-border font-bold text-ds-muted ${miscCls}`}
              aria-label="First aid"
            >
              FA
            </span>
          );
        }
        return (
          <span
            key={c}
            className={`inline-flex shrink-0 max-w-8 items-center justify-center rounded border border-pulseShell-border font-bold text-ds-muted ${miscCls}`}
          >
            {c.length > 3 ? c.slice(0, 2) : c}
          </span>
        );
      })}
    </span>
  );
}
