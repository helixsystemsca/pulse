"use client";

import { Minus, Plus } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const TX_BTN_RADIUS = "rounded-xl";
const TX_BTN_RADIUS_SM = "rounded-lg";

export function txHaptic(ms = 14) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(ms);
  }
}

const bubbleStroke = "border-2 border-[color-mix(in_srgb,var(--ds-text-primary)_28%,var(--ds-border))]";
const bubbleDepth =
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-2px_4px_rgba(15,23,42,0.07)] active:translate-y-px active:shadow-[inset_0_3px_8px_rgba(15,23,42,0.14)]";

export const txBubbleBase = cn(
  "relative overflow-hidden transition-[transform,box-shadow,background-color] duration-100 disabled:pointer-events-none disabled:opacity-45",
  bubbleStroke,
  bubbleDepth,
);

export const txBubbleIdle = cn(
  txBubbleBase,
  TX_BTN_RADIUS,
  "bg-[color-mix(in_srgb,var(--ds-surface-elevated)_88%,white)] text-ds-foreground",
);

export const txBubblePrimary = cn(
  txBubbleBase,
  TX_BTN_RADIUS,
  "border-[color-mix(in_srgb,var(--ds-accent)_75%,#0f172a)]",
  "bg-gradient-to-b from-[color-mix(in_srgb,var(--ds-accent)_92%,#38bdf8)] to-[color-mix(in_srgb,var(--ds-accent)_78%,#0284c7)]",
  "text-white",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-3px_6px_rgba(0,0,0,0.18)]",
);

export const txBubbleIssue = cn(
  txBubbleBase,
  TX_BTN_RADIUS,
  "border-[#e85d6f]",
  "bg-gradient-to-b from-[color-mix(in_srgb,#e85d6f_20%,white)] to-[color-mix(in_srgb,#e85d6f_8%,var(--ds-surface-secondary))]",
  "text-[color-mix(in_srgb,#e85d6f_88%,#0f172a)]",
);

export const txBubbleReceive = cn(
  txBubbleBase,
  TX_BTN_RADIUS,
  "border-[var(--ds-success)]",
  "bg-gradient-to-b from-[color-mix(in_srgb,var(--ds-success)_22%,white)] to-[color-mix(in_srgb,var(--ds-success)_8%,var(--ds-surface-secondary))]",
  "text-[color-mix(in_srgb,var(--ds-success)_85%,#0f172a)]",
);

type TxButtonProps = ComponentPropsWithoutRef<"button">;

export function TxBubbleButton({ className, disabled, onPointerDown, ...rest }: TxButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(txBubbleIdle, className)}
      onPointerDown={(e) => {
        if (!disabled) txHaptic();
        onPointerDown?.(e);
      }}
    />
  );
}

export function TxQtyStepper({
  quantity,
  onChange,
  busy,
  max,
}: {
  quantity: number;
  onChange: (n: number) => void;
  busy?: boolean;
  max?: number;
}) {
  const cap = max ?? 9999;
  const adjust = (delta: number) => {
    const next = Math.max(1, Math.min(cap, quantity + delta));
    onChange(next);
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <TxBubbleButton
        type="button"
        aria-label="Decrease quantity"
        disabled={busy || quantity <= 1}
        onClick={() => adjust(-1)}
        className="flex h-16 w-16 shrink-0 items-center justify-center !p-0 sm:h-20 sm:w-20"
      >
        <Minus className="h-8 w-8" />
      </TxBubbleButton>
      <input
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={1}
        max={cap}
        value={quantity}
        disabled={busy}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(1, Math.min(cap, n)));
        }}
        className="h-16 w-24 rounded-xl border-2 border-ds-border bg-ds-primary text-center text-3xl font-bold tabular-nums text-ds-foreground focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/30 sm:h-20 sm:w-28 sm:text-4xl"
        aria-label="Quantity"
      />
      <TxBubbleButton
        type="button"
        aria-label="Increase quantity"
        disabled={busy || quantity >= cap}
        onClick={() => adjust(1)}
        className="flex h-16 w-16 shrink-0 items-center justify-center !p-0 sm:h-20 sm:w-20"
      >
        <Plus className="h-8 w-8" />
      </TxBubbleButton>
    </div>
  );
}

export function TxHomeTile({
  label,
  description,
  className,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  className?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TxBubbleButton
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn("flex min-h-[5.5rem] w-full flex-col items-start justify-center px-5 py-4 text-left sm:min-h-[6rem]", className)}
    >
      <span className="text-lg font-bold sm:text-xl">{label}</span>
      <span className="mt-1 text-sm font-medium opacity-80">{description}</span>
    </TxBubbleButton>
  );
}

export const txFieldClass =
  "mt-1 w-full rounded-xl border-2 border-ds-border bg-ds-primary px-4 py-3 text-base text-ds-foreground focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/25";

export const txLabelClass = "text-xs font-bold uppercase tracking-wider text-ds-muted";
