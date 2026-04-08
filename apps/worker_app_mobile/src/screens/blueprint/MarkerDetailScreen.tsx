import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { MOCK_MARKERS } from "@/data/mockBlueprint";
import { Card } from "@/components/Card";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, space, typography } from "@/utils/designTokens";

export function MarkerDetailScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation();
  const route = useRoute();
  const { markerId } = route.params as { markerId: string };
  const m = MOCK_MARKERS.find((x) => x.id === markerId);

  if (!m) {
    return (
      <ScreenContainer scroll bottomInset={tabBar}>
        <Text style={typography.body}>Marker not found.</Text>
        <SecondaryButton label="Back" onPress={() => nav.goBack()} style={{ marginTop: space.lg }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <SecondaryButton label="← Blueprint" onPress={() => nav.goBack()} style={styles.back} />
      <Text style={[typography.title, styles.title]}>{m.equipmentName}</Text>
      <Text style={[typography.bodySm, styles.sub]}>Marker {m.label}</Text>

      <Card>
        <Text style={[typography.subtitle, styles.block]}>Active tasks</Text>
        {m.activeTaskTitles.length ? (
          m.activeTaskTitles.map((t) => (
            <Text key={t} style={[typography.bodySm, styles.task]}>
              · {t}
            </Text>
          ))
        ) : (
          <Text style={[typography.bodySm, styles.muted]}>No open tasks linked.</Text>
        )}
      </Card>
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", marginBottom: space.md },
  title: { color: colors.textPrimary },
  sub: { color: colors.textSecondary, marginBottom: space.lg },
  block: { color: colors.textPrimary, marginBottom: space.sm },
  task: { color: colors.textPrimary, marginTop: 6 },
  muted: { color: colors.textTertiary },
});
