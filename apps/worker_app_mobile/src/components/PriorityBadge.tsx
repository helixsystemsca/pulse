import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "@/utils/designTokens";
import type { TaskPriority } from "@/types/models";

const MAP: Record<TaskPriority, { label: string; bg: string; fg: string }> = {
  low: { label: "Low", bg: colors.surfaceElevated, fg: colors.textSecondary },
  medium: { label: "Medium", bg: colors.warningSoft, fg: colors.warning },
  high: { label: "High", bg: colors.dangerSoft, fg: colors.danger },
  critical: { label: "Critical", bg: colors.danger, fg: "#fff" },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const m = MAP[priority];
  return (
    <View style={[styles.wrap, { backgroundColor: m.bg }]}>
      <Text style={[typography.micro, { color: m.fg }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
