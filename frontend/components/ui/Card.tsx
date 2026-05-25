import type { ReactNode } from "react";
import { Card as PulseCard, type CardVariant } from "@/components/pulse/Card";

/** @deprecated Prefer `@/components/pulse/Card` — this wrapper maps to the canonical ds-card surface. */
export function Card({
  children,
  className = "",
  variant = "primary",
}: {
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}) {
  return (
    <PulseCard variant={variant} padding="md" className={className}>
      {children}
    </PulseCard>
  );
}
