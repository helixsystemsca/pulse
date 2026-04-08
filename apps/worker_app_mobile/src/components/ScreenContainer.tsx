import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, layout, space } from "@/utils/designTokens";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom inset for tab bar */
  bottomInset?: number;
};

export function ScreenContainer({ children, scroll, bottomInset = 0 }: Props) {
  const pad = { paddingBottom: space.lg + bottomInset };

  if (scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, pad]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, pad]} edges={["top", "left", "right"]}>
      <View style={styles.fill}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  fill: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingH,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingH,
    flexGrow: 1,
  },
});
