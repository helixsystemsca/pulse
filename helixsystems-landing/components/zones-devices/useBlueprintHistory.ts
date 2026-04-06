"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlueprintElement, BlueprintState } from "./blueprint-types";

const DEFAULT_MAX = 50;

/** Shallow snapshot for history stacks (copy array-valued fields). */
function cloneElementsForHistory(elements: BlueprintElement[]): BlueprintElement[] {
  return elements.map((el) => ({
    ...el,
    path_points: el.path_points ? el.path_points.slice() : undefined,
    symbol_tags: el.symbol_tags ? el.symbol_tags.slice() : undefined,
  }));
}

function cloneBlueprintState(s: BlueprintState): BlueprintState {
  return { elements: cloneElementsForHistory(s.elements) };
}

export type UseBlueprintHistoryOptions = {
  /** Max undo/redo steps per branch (default 50). */
  maxDepth?: number;
  initial?: BlueprintState;
};

/**
 * Central blueprint + history: only {@link BlueprintState} participates in undo/redo.
 * Use {@link updateBlueprint} for commits; {@link replaceBlueprint} for transient updates (drag frames).
 */
export function useBlueprintHistory(options?: UseBlueprintHistoryOptions) {
  const max = options?.maxDepth ?? DEFAULT_MAX;
  const [present, setPresent] = useState<BlueprintState>(() => options?.initial ?? { elements: [] });

  const pastRef = useRef<BlueprintState[]>([]);
  const futureRef = useRef<BlueprintState[]>([]);
  const presentRef = useRef(present);

  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const updateBlueprint = useCallback(
    (next: BlueprintState | ((prev: BlueprintState) => BlueprintState)) => {
      setPresent((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved.elements === prev.elements) return prev;
        pastRef.current = [...pastRef.current, cloneBlueprintState(prev)].slice(-max);
        futureRef.current = [];
        return resolved;
      });
    },
    [max],
  );

  /** Set present without touching history (mid-drag / live transform sync). */
  const replaceBlueprint = useCallback((next: BlueprintState | ((prev: BlueprintState) => BlueprintState)) => {
    setPresent((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      if (resolved.elements === prev.elements) return prev;
      return resolved;
    });
  }, []);

  /** Push current present to `past` and clear `future` without changing present (call once per drag/transform session). */
  const checkpointBlueprint = useCallback(() => {
    const snap = cloneBlueprintState(presentRef.current);
    pastRef.current = [...pastRef.current, snap].slice(-max);
    futureRef.current = [];
  }, [max]);

  const undoBlueprint = useCallback((): BlueprintState | null => {
    if (pastRef.current.length === 0) return null;
    let restored: BlueprintState | null = null;
    setPresent((prev) => {
      const cur = cloneBlueprintState(prev);
      futureRef.current = [cur, ...futureRef.current].slice(0, max);
      restored = pastRef.current.pop()!;
      return restored;
    });
    return restored;
  }, [max]);

  const redoBlueprint = useCallback((): BlueprintState | null => {
    if (futureRef.current.length === 0) return null;
    let restored: BlueprintState | null = null;
    setPresent((prev) => {
      const cur = cloneBlueprintState(prev);
      pastRef.current = [...pastRef.current, cur].slice(-max);
      restored = futureRef.current.shift()!;
      return restored;
    });
    return restored;
  }, [max]);

  const resetBlueprint = useCallback((state: BlueprintState) => {
    pastRef.current = [];
    futureRef.current = [];
    setPresent(state);
  }, []);

  /** Clear stacks only; present unchanged (rare; prefer {@link resetBlueprint} when replacing document). */
  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  return {
    /** Current undoable document (present). */
    blueprint: present,
    /** Sync ref to present; same as blueprint after flush. */
    blueprintRef: presentRef,
    updateBlueprint,
    replaceBlueprint,
    checkpointBlueprint,
    undoBlueprint,
    redoBlueprint,
    resetBlueprint,
    clearHistory,
  };
}
