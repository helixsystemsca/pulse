import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";
import type { ActionButtonVariant } from "@/utils/uiTypes";

export type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  loading?: boolean;
};

const variantStyle: Record<
  ActionButtonVariant,
  { bg: string; text: string; border: string }
> = {
  primary: { bg: colors.accent, text: "#FFFFFF", border: colors.accent },
  secondary: { bg: colors.surface, text: colors.textPrimary, border: colors.border },
  ghost: { bg: "transparent", text: colors.accent, border: colors.border },
  danger: { bg: colors.danger, text: "#FFFFFF", border: colors.danger },
};

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: ActionButtonProps) {
  const v = variantStyle[variant];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.88}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTap,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.body,
    fontWeight: "700",
  },
});
