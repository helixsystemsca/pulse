import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, layout, radius, typography } from "@/utils/designTokens";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SecondaryButton({ label, onPress, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[typography.bodySm, styles.text]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: layout.minTap,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  text: { color: colors.textPrimary, fontWeight: "700" },
  pressed: { backgroundColor: colors.surfaceElevated },
  disabled: { opacity: 0.45 },
});
