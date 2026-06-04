"use client";

import { useCallback, useState } from "react";

export type AsyncSubmitPhase = "idle" | "loading" | "success" | "error";

/** Matches tour check draw + pulse (~1.25s); callers await this before closing modals. */
export const ASYNC_SUBMIT_SUCCESS_MS = 1300;
export const ASYNC_SUBMIT_ERROR_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Run an async action with loading → checkmark (or shake on error) → idle. Resolves after the feedback animation. */
export async function runAsyncSubmit(
  setPhase: (phase: AsyncSubmitPhase) => void,
  fn: () => Promise<void>,
  opts?: {
    successMs?: number;
    errorMs?: number;
    /** When false, swallows the error after the error animation. Default true. */
    rethrow?: boolean;
    /** When false, resolves immediately after the action (no success/error dwell). Default true. */
    waitForAnimation?: boolean;
  },
): Promise<void> {
  const wait = opts?.waitForAnimation !== false;
  setPhase("loading");
  try {
    await fn();
    setPhase("success");
    if (wait) await delay(opts?.successMs ?? ASYNC_SUBMIT_SUCCESS_MS);
    setPhase("idle");
  } catch (e) {
    setPhase("error");
    if (wait) await delay(opts?.errorMs ?? ASYNC_SUBMIT_ERROR_MS);
    setPhase("idle");
    if (opts?.rethrow !== false) throw e;
  }
}

export function useAsyncSubmitPhase() {
  const [phase, setPhase] = useState<AsyncSubmitPhase>("idle");

  const run = useCallback(
    (fn: () => Promise<void>, opts?: Parameters<typeof runAsyncSubmit>[2]) =>
      runAsyncSubmit(setPhase, fn, opts),
    [],
  );

  const reset = useCallback(() => setPhase("idle"), []);

  return { phase, setPhase, run, reset };
}

/** True when the label is a primary commit action (save, submit, complete, finish). */
export function isSubmitActionLabel(label: string): boolean {
  const n = label.trim().toLowerCase();
  return (
    /^save\b/.test(n) ||
    /\bsave$/.test(n) ||
    /^submit\b/.test(n) ||
    /\bsubmit$/.test(n) ||
    /^complete\b/.test(n) ||
    /\bcomplete$/.test(n) ||
    /^finish\b/.test(n) ||
    /\bfinish$/.test(n) ||
    n === "done" ||
    n === "create" ||
    n === "add" ||
    /^record\b/.test(n) ||
    /^publish\b/.test(n) ||
    /^close request/.test(n)
  );
}
