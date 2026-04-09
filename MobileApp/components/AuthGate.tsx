"use client";

import type { Href } from "expo-router";
import { Redirect, Slot, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Requires login (same users as Pulse web) unless route is under `/login`.
 */
export function AuthGate() {
  const { session, authReady } = useSession();
  const segments = useSegments();
  const { colors } = useTheme();

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  const onLogin = (segments as string[]).includes("login");

  if (!session && !onLogin) {
    return <Redirect href={"/login" as Href} />;
  }

  if (session && onLogin) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
