"use client";

import React, { useMemo } from "react";
import { ImageBackground, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  greetingName: string;
};

export function DashboardHeroHeader({ greetingName }: Props) {
  const { colors, spacing, radii } = useTheme();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const firstName = useMemo(() => {
    const s = greetingName.trim();
    return s ? s.split(/\s+/)[0] ?? "there" : "there";
  }, [greetingName]);

  return (
    <View style={{ borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
      <ImageBackground source={require("../../assets/images/panorama.jpg")} resizeMode="cover">
        <LinearGradient
          colors={["rgba(9,16,28,0.15)", "rgba(9,16,28,0.72)", "rgba(9,16,28,0.92)"]}
          locations={[0, 0.55, 1]}
          style={{ padding: spacing.lg }}
        >
          <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "800", letterSpacing: 1.2 }}>
            WELCOME
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "900", marginTop: 6, lineHeight: 30 }}>
            {greeting}, {firstName}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.78)", marginTop: 8, fontSize: 13, lineHeight: 18 }}>
            Jump back into your day: tasks, schedule, documents, and updates.
          </Text>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

