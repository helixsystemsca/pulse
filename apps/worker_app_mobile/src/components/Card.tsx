import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius, shadows, space } from "@/utils/designTokens";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

export function Card({ children, style }: Props) {
  return <View style={[styles.card, shadows.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: space.lg,
  },
});
