import { StyleSheet, Text, View } from "react-native";
import { colors, space, typography } from "@/utils/designTokens";

type Props = {
  title: string;
  subtitle?: string;
};

export function EmptyState({ title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[typography.subtitle, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[typography.bodySm, styles.sub]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    alignItems: "center",
  },
  title: { color: colors.textPrimary, textAlign: "center" },
  sub: { color: colors.textSecondary, textAlign: "center", marginTop: space.sm },
});
