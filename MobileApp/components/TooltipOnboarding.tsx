import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, type LayoutRectangle } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "@/theme/ThemeProvider";

const KEY = "pulse.mobile.hasSeenOnboarding";

export type OnboardingStep = {
  id: string;
  title: string;
  body: string;
  /** Optional target rect for highlight/glow */
  target?: LayoutRectangle | null;
};

export function TooltipOnboarding({
  steps,
  enabled = true,
}: {
  steps: OnboardingStep[];
  enabled?: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    (async () => {
      const seen = await SecureStore.getItemAsync(KEY);
      setOpen(seen !== "true");
      setReady(true);
    })();
  }, [enabled]);

  const step = steps[idx] ?? null;

  const finish = async () => {
    await SecureStore.setItemAsync(KEY, "true");
    setOpen(false);
  };

  const next = async () => {
    if (idx >= steps.length - 1) {
      await finish();
      return;
    }
    setIdx((n) => n + 1);
  };

  const overlay = useMemo(
    () => ({
      position: "absolute" as const,
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.30)",
    }),
    [],
  );

  if (!ready || !open || !step) return null;

  const t = step.target;
  return (
    <View style={{ position: "absolute", inset: 0 }} pointerEvents="box-none">
      <Pressable style={overlay} onPress={finish} />

      {t ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: Math.max(8, t.x - 10),
            top: Math.max(8, t.y - 10),
            width: t.width + 20,
            height: t.height + 20,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.success,
            shadowColor: colors.success,
            shadowOpacity: 0.35,
            shadowRadius: 14,
          }}
        />
      ) : null}

      <View
        style={{
          position: "absolute",
          left: spacing.lg,
          right: spacing.lg,
          bottom: spacing.xl,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: spacing.lg,
          shadowColor: "#000",
          shadowOpacity: 0.22,
          shadowRadius: 14,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>{step.title}</Text>
        <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13, lineHeight: 18 }}>{step.body}</Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
          <Pressable
            onPress={finish}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Skip</Text>
          </Pressable>
          <Pressable
            onPress={next}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: colors.success,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>{idx >= steps.length - 1 ? "Done" : "Next"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

