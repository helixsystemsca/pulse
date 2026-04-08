import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, space, typography } from "@/utils/designTokens";

export function AvailabilityEditorScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation();

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <Text style={[typography.title, styles.title]}>Availability</Text>
      <Text style={[typography.bodySm, styles.sub]}>
        Quick editor placeholder — connect to `/pulse/workers/.../profile` availability JSON when ready.
      </Text>
      <View style={styles.row}>
        <SecondaryButton label="Cancel" onPress={() => nav.goBack()} style={styles.flex} />
        <PrimaryButton
          label="Save"
          onPress={() => Alert.alert("Saved", "Availability updated (mock).", [{ text: "OK", onPress: () => nav.goBack() }])}
          style={styles.flex}
        />
      </View>
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary },
  sub: { color: colors.textSecondary, marginVertical: space.lg, lineHeight: 22 },
  row: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
});
