"use client";

import React, { useMemo } from "react";
import { ImageBackground, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  greetingName: string;
};

export function DashboardHeroHeader({ greetingName }: Props) {
  const { colors, spacing, radii } = useTheme();
  const router = useRouter();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const firstName = useMemo(() => {
    const s = greetingName.trim();
    return s ? s.split(/\s+/)[0] ?? "there" : "there";
  }, [greetingName]);

  const Quick = ({ label, href }: { label: string; href: string }) => (
    <Pressable
      onPress={() => router.push(href as never)}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.16)",
        borderColor: "rgba(255,255,255,0.26)",
        borderWidth: 1,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
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

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.md }}>
            <Quick label="My Tasks" href="/(tabs)/tasks" />
            <Quick label="My Schedule" href="/(tabs)/schedule" />
            <Quick label="Documents" href="/(tabs)/documents" />
            <Quick label="Search" href="/(tabs)/search" />
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

