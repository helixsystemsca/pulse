import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";
import type { AlertItemData, AlertSeverity } from "@/utils/uiTypes";

export type { AlertItemData };

const severityBar: Record<AlertSeverity, string> = {
  info: colors.accent,
  warning: colors.warning,
  critical: colors.danger,
};

export type AlertCardProps = AlertItemData & {
  onPress?: (id: string) => void;
};

export function AlertCard({ id, title, message, timeLabel, severity, onPress }: AlertCardProps) {
  const Card = onPress ? TouchableOpacity : View;
  return (
    <Card
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress ? () => onPress(id) : undefined}
      activeOpacity={0.92}
      style={[styles.card, shadows.card]}
    >
      <View style={[styles.accentBar, { backgroundColor: severityBar[severity] }]} />
      <View style={styles.content}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.timePill}>
            <Text style={styles.time}>{timeLabel}</Text>
          </View>
        </View>
        <Text style={styles.message} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginHorizontal: space.sm,
    marginBottom: space.md,
    overflow: "hidden",
    minHeight: layout.minTap + 28,
  },
  accentBar: { width: 4 },
  content: { flex: 1, padding: space.md },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  title: {
    flex: 1,
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  timePill: {
    backgroundColor: colors.canvas,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  time: { ...typography.micro, color: colors.textSecondary },
  message: {
    marginTop: space.sm,
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
