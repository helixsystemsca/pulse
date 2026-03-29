import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";
import type { ToolItemData } from "@/utils/uiTypes";

export type { ToolItemData };

const toneIcon = {
  success: { name: "check-circle-outline" as const, color: colors.success },
  neutral: { name: "map-marker-radius" as const, color: colors.textSecondary },
  warning: { name: "alert-outline" as const, color: colors.warning },
  danger: { name: "alert-octagon-outline" as const, color: colors.danger },
} satisfies Record<ToolItemData["statusVariant"], { name: string; color: string }>;

export type ToolItemProps = ToolItemData & {
  onPress?: (id: string) => void;
};

export function ToolItem({ id, name, code, statusLabel, statusVariant, onPress }: ToolItemProps) {
  const icon = toneIcon[statusVariant];
  const Row = onPress ? TouchableOpacity : View;
  return (
    <Row
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress ? () => onPress(id) : undefined}
      activeOpacity={0.9}
      style={[styles.row, shadows.card]}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon.name} size={24} color={icon.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <Text style={styles.code}>{code}</Text>
        <Text style={[styles.status, { color: icon.color }]}>{statusLabel}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
    minHeight: layout.minTap + 8,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  body: { flex: 1 },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  code: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  status: {
    ...typography.caption,
    marginTop: space.xs,
    fontWeight: "700",
  },
});
