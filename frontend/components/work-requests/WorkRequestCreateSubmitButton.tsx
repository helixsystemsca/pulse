"use client";

import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import type { AsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";

export type WorkRequestCreateSubmitPhase = AsyncSubmitPhase;

type WorkRequestCreateSubmitButtonProps = {
  phase: WorkRequestCreateSubmitPhase;
  onClick: () => void;
  disabled?: boolean;
  idleLabel?: string;
  loadingLabel?: string;
  successSrLabel?: string;
};

/** @deprecated Prefer `AsyncSubmitButton` — kept for work-request create/review flows. */
export function WorkRequestCreateSubmitButton(props: WorkRequestCreateSubmitButtonProps) {
  return <AsyncSubmitButton minWidth="min-w-[11rem]" {...props} />;
}
