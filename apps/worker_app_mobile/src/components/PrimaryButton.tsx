import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, layout, radius, typography } from "@/utils/designTokens";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "danger" | "ghost";
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  icon,
  style,
}: Props) {
  const bg =
    variant === "danger"
      ? colors.danger
      : variant === "ghost"
        ? colors.surfaceElevated
        : colors.accent;
  const fg =
    variant === "ghost" ? colors.textPrimary : variant === "danger" ? "#fff" : "#fff";
  const border = variant === "ghost" ? { borderWidth: 1, borderColor: colors.border } : {};

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg },
        border,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={[typography.bodySm, { color: fg, fontWeight: "700" }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: layout.minTap,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.45 },
});
