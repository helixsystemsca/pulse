import React, { type ReactNode } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Mobile-safe screen wrapper:
 * - Reserves top/bottom safe areas so content doesn't sit under OS UI
 * - Applies Pulse background color consistently
 */
export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>
    </SafeAreaView>
  );
}

