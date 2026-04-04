import { StyleSheet, Text, View } from "react-native";
import { colors, space, typography } from "@/utils/designTokens";

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.box}>
      <Text style={[typography.section, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[typography.bodySm, styles.sub]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: space.xl,
    paddingHorizontal: space.md,
    alignItems: "center",
  },
  title: { color: colors.textPrimary, textAlign: "center" },
  sub: { marginTop: space.sm, color: colors.textSecondary, textAlign: "center" },
});
