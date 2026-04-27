import React from "react";
import { Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";

export default function DocumentsScreen() {
  const { colors, spacing, text } = useTheme();
  return (
    <Screen>
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Documents</Text>
        <Text style={{ color: colors.muted, marginTop: spacing.sm }}>
          Coming soon.
        </Text>
      </View>
    </Screen>
  );
}

