import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "@/utils/designTokens";

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.gap}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.lineLg} />
          <View style={styles.lineSm} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  lineLg: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.borderSubtle,
    width: "72%",
    marginBottom: 10,
  },
  lineSm: {
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.borderSubtle,
    width: "48%",
  },
});
