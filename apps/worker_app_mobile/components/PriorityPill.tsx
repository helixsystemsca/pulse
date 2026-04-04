import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "@/utils/designTokens";

const MAP: Record<string, { bg: string; fg: string; label: string }> = {
  critical: { bg: colors.dangerSoft, fg: colors.danger, label: "Critical" },
  high: { bg: colors.warningSoft, fg: colors.warning, label: "High" },
  medium: { bg: colors.surfaceMuted, fg: colors.textSecondary, label: "Medium" },
  low: { bg: colors.successSoft, fg: colors.success, label: "Low" },
};

export function PriorityPill({ priority }: { priority: string }) {
  const key = priority.toLowerCase();
  const m = MAP[key] ?? MAP.medium;
  return (
    <View style={[styles.wrap, { backgroundColor: m.bg }]}>
      <Text style={[typography.caption, { color: m.fg }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
