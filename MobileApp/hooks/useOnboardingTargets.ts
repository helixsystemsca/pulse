import { useCallback, useMemo, useState } from "react";
import type { LayoutRectangle, View } from "react-native";

/**
 * Tiny helper to capture layouts for tooltip highlighting.
 * Usage: const { onLayoutFor, targets } = useOnboardingTargets();
 * <View onLayout={onLayoutFor("tasks")} ... />
 */
export function useOnboardingTargets() {
  const [targets, setTargets] = useState<Record<string, LayoutRectangle | null>>({});

  const onLayoutFor = useCallback(
    (id: string) => (e: { nativeEvent: { layout: LayoutRectangle } }) => {
      setTargets((prev) => ({ ...prev, [id]: e.nativeEvent.layout }));
    },
    [],
  );

  return useMemo(() => ({ targets, onLayoutFor }), [onLayoutFor, targets]);
}

