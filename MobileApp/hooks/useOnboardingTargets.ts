import { useCallback, useMemo, useState } from "react";
import type { LayoutChangeEvent, LayoutRectangle } from "react-native";

/**
 * Tiny helper to capture layouts for tooltip highlighting.
 * Usage: const { onLayoutFor, targets } = useOnboardingTargets();
 * <View onLayout={onLayoutFor("tasks")} ... />
 */
export function useOnboardingTargets() {
  const [targets, setTargets] = useState<Record<string, LayoutRectangle | null>>({});

  const onLayoutFor = useCallback(
    (id: string) => (e: LayoutChangeEvent | null | undefined) => {
      const layout = e?.nativeEvent?.layout ?? null;
      if (!layout) return;
      setTargets((prev) => ({ ...prev, [id]: layout }));
    },
    [],
  );

  return useMemo(() => ({ targets, onLayoutFor }), [onLayoutFor, targets]);
}

