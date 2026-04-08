import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute } from "@react-navigation/native";
import { StyleSheet, Text, View } from "react-native";
import { MOCK_PROJECTS } from "@/data/mockProjects";
import { Card } from "@/components/Card";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, space, typography } from "@/utils/designTokens";

export function ProjectDetailScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation();
  const route = useRoute();
  const { projectId } = route.params as { projectId: string };
  const p = MOCK_PROJECTS.find((x) => x.id === projectId);

  if (!p) {
    return (
      <ScreenContainer scroll bottomInset={tabBar}>
        <Text style={typography.body}>Project not found.</Text>
        <SecondaryButton label="Back" onPress={() => nav.goBack()} style={{ marginTop: space.lg }} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <SecondaryButton label="← Projects" onPress={() => nav.goBack()} style={styles.back} />
      <Text style={[typography.title, styles.title]}>{p.name}</Text>
      <Text style={[typography.bodySm, styles.status]}>{p.statusLabel}</Text>

      <Card>
        <Text style={[typography.subtitle, styles.block]}>Progress</Text>
        <View style={styles.barBg}>
          <View style={[styles.barFg, { width: `${p.progressPct}%` }]} />
        </View>
        <Text style={[typography.caption, styles.pct]}>{p.progressPct}%</Text>
        <Text style={[typography.bodySm, styles.body]}>
          High-level health for the field app. Detailed Gantt and documents stay in the web console.
        </Text>
      </Card>
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", marginBottom: space.md },
  title: { color: colors.textPrimary },
  status: { color: colors.textSecondary, marginBottom: space.lg },
  block: { color: colors.textPrimary, marginBottom: space.sm },
  barBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.borderSubtle,
    overflow: "hidden",
  },
  barFg: { height: "100%", backgroundColor: colors.accent },
  pct: { color: colors.textTertiary, marginTop: 8 },
  body: { color: colors.textSecondary, marginTop: space.lg, lineHeight: 22 },
});
