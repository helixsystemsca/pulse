import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "@/utils/designTokens";
import type { TaskStatus } from "@/types/models";

const MAP: Record<TaskStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: colors.surfaceElevated, fg: colors.textSecondary },
  in_progress: { label: "In progress", bg: colors.accentMuted, fg: colors.accent },
  paused: { label: "Paused", bg: colors.warningSoft, fg: colors.warning },
  completed: { label: "Done", bg: colors.successSoft, fg: colors.success },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = MAP[status];
  return (
    <View style={[styles.wrap, { backgroundColor: m.bg }]}>
      <Text style={[typography.micro, { color: m.fg }]}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
