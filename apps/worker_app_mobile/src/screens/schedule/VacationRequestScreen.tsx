import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radius, space, typography } from "@/utils/designTokens";

export function VacationRequestScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation();

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <Text style={[typography.title, styles.title]}>Request vacation</Text>
      <Text style={[typography.bodySm, styles.sub]}>Submit to manager approval (mock UI).</Text>
      <TextInput style={styles.input} placeholder="Start date" placeholderTextColor={colors.textTertiary} />
      <TextInput style={styles.input} placeholder="End date" placeholderTextColor={colors.textTertiary} />
      <TextInput
        style={[styles.input, styles.area]}
        placeholder="Notes"
        placeholderTextColor={colors.textTertiary}
        multiline
      />
      <View style={styles.row}>
        <SecondaryButton label="Cancel" onPress={() => nav.goBack()} style={styles.flex} />
        <PrimaryButton
          label="Submit"
          onPress={() => Alert.alert("Sent", "Vacation request queued (mock).", [{ text: "OK", onPress: () => nav.goBack() }])}
          style={styles.flex}
        />
      </View>
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary },
  sub: { color: colors.textSecondary, marginVertical: space.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: space.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  area: { minHeight: 88, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: space.md, marginTop: space.md },
  flex: { flex: 1 },
});
