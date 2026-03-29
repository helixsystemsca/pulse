import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";
import type { StatusVariant } from "@/utils/uiTypes";

export type StatusCardProps = {
  label: string;
  value: string;
  hint?: string;
  variant?: StatusVariant;
  onPress?: () => void;
};

const variantStyles: Record<
  StatusVariant,
  { valueColor: string; border: string; softBg: string }
> = {
  default: {
    valueColor: colors.textPrimary,
    border: colors.borderSubtle,
    softBg: colors.surface,
  },
  success: {
    valueColor: colors.success,
    border: colors.successSoft,
    softBg: colors.successSoft,
  },
  warning: {
    valueColor: colors.warning,
    border: colors.warningSoft,
    softBg: colors.warningSoft,
  },
  danger: {
    valueColor: colors.danger,
    border: colors.dangerSoft,
    softBg: colors.dangerSoft,
  },
};

export function StatusCard({ label, value, hint, variant = "default", onPress }: StatusCardProps) {
  const v = variantStyles[variant];
  const Card = onPress ? TouchableOpacity : View;
  return (
    <Card
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.card, shadows.card, { borderColor: v.border, backgroundColor: v.softBg }]}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: v.valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 118,
    minHeight: layout.minTap + 36,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    justifyContent: "center",
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: space.xs,
  },
  value: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: space.xs,
  },
});
