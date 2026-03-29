import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, layout, space, typography } from "@/utils/designTokens";

export type HeaderProps = {
  /** Small top line (e.g. shift or section label). */
  eyebrow?: string;
  /** Primary headline. */
  title: string;
  rightAccessory?: ReactNode;
};

export function Header({ eyebrow, title, rightAccessory }: HeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {rightAccessory ? <View style={styles.right}>{rightAccessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenPaddingH,
    paddingTop: layout.headerTopPadding,
    paddingBottom: space.md,
  },
  textBlock: { flex: 1, paddingRight: space.sm },
  eyebrow: {
    ...typography.screenTitle,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: space.xs,
  },
  title: {
    ...typography.greeting,
    color: colors.textPrimary,
  },
  right: { justifyContent: "center", minHeight: layout.minTap },
});
