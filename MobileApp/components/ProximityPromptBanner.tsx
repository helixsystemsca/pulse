import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  onDismiss: () => void;
  /** Push the bar down (e.g. home tab hero) so it sits under the image header, not on top of it. */
  layoutTopOffset?: number;
};

/** Fixed strip (secondary header) until user opens or dismisses — stays above Pixel gesture nav. */
export function ProximityPromptBanner({
  title,
  message,
  primaryLabel,
  onPrimary,
  onDismiss,
  layoutTopOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [opacity, slide]);

  const chrome = useMemo(
    () => ({
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingTop: insets.top + layoutTopOffset + spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    }),
    [colors.border, colors.surface, insets.top, layoutTopOffset, spacing.lg, spacing.md, spacing.sm],
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 1000,
        opacity,
        transform: [{ translateY: slide }],
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 5,
      }}
      pointerEvents="box-none"
    >
      <View style={chrome}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
        <Text
          style={{ color: colors.muted, marginTop: 6, fontSize: 13, lineHeight: 18 }}
          numberOfLines={3}
        >
          {message}
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing.md, gap: 10 }}>
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
  );
}
