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
  /** Pixels below status bar to clear dashboard image + greeting + avatar (home); 0 on other tabs. */
  heroClearance?: number;
};

/** Fixed strip (secondary header) until user opens or dismisses — stays above Pixel gesture nav. */
export function ProximityPromptBanner({
  title,
  message,
  primaryLabel,
  onPrimary,
  onDismiss,
  heroClearance = 0,
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

  const dusk = colors.background;
  const aqua = colors.success;

  const bannerTop = insets.top + heroClearance;

  const notificationBodyStyle = useMemo(
    () => ({
      backgroundColor: aqua,
      borderBottomWidth: 1,
      borderBottomColor: dusk,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    }),
    [aqua, dusk, spacing.lg, spacing.md, spacing.sm],
  );

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: bannerTop,
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
      <View style={notificationBodyStyle}>
        <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>{title}</Text>
        <Text
          style={{ color: "rgba(255,255,255,0.92)", marginTop: 6, fontSize: 13, lineHeight: 18 }}
          numberOfLines={3}
        >
          {message}
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing.md, gap: 10 }}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              borderWidth: 2,
              borderColor: dusk,
              backgroundColor: pressed ? "rgba(76,96,133,0.35)" : "rgba(255,255,255,0.18)",
              alignItems: "center",
            })}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Dismiss</Text>
          </Pressable>
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: dusk,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{primaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
