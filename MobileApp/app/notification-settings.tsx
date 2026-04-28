import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";

export default function NotificationSettingsScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const router = useRouter();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.success, fontWeight: "900" }}>← Back</Text>
        </Pressable>

        <Text style={{ color: colors.text, ...text.h1 }}>Notifications</Text>
        <Text style={{ color: colors.muted, marginTop: 8, ...text.body }}>
          Notification preferences are coming soon.
        </Text>

        <View
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radii.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "900" }}>Planned</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            - Shift publish alerts{"\n"}- Work request updates{"\n"}- Proximity prompts{"\n"}- Badge / XP updates
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

