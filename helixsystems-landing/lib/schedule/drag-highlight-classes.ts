import type { WorkerDayHighlightTone } from "@/lib/schedule/worker-drag-highlights";

/** Soft tint overlay for calendar cells while dragging a worker. */
export function workerHighlightOverlayClass(tone: WorkerDayHighlightTone | undefined): string {
  if (!tone || tone === "neutral") return "";
  if (tone === "good") return "bg-[color-mix(in_srgb,var(--ds-success)_18%,transparent)]";
  if (tone === "warning") return "bg-[color-mix(in_srgb,var(--ds-warning)_22%,transparent)]";
  return "bg-[color-mix(in_srgb,var(--ds-danger)_18%,transparent)]";
}
