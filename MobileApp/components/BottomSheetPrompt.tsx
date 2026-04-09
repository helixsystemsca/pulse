import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function BottomSheetPrompt({
  title,
  message,
  primaryLabel,
  onPrimary,
  onDismiss,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  onDismiss: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  const y = useRef(new Animated.Value(24)).current;
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }, [a, y]);

  const sheetStyle = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      padding: spacing.lg,
    }),
    [colors, radii.lg, spacing.lg],
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        opacity: a,
      }}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onDismiss}
        style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.25)" }}
      />
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        <View style={sheetStyle}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13, lineHeight: 18 }}>{message}</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
            <Pressable
              onPress={onDismiss}
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
              <Text style={{ color: colors.text, fontWeight: "700" }}>Dismiss</Text>
            </Pressable>
            <Pressable
              onPress={onPrimary}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: radii.md,
                backgroundColor: colors.success,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#0A0A0A", fontWeight: "800" }}>{primaryLabel}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

