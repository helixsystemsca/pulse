import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { MOCK_TOOLS } from "@/data/mockTools";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, space, typography } from "@/utils/designTokens";
import type { ToolStatus } from "@/types/models";

function toolStatusStyle(s: ToolStatus): { bg: string; fg: string; label: string } {
  switch (s) {
    case "available":
      return { bg: colors.successSoft, fg: colors.success, label: "Available" };
    case "in_use":
      return { bg: colors.accentMuted, fg: colors.accent, label: "In use" };
    case "missing":
    default:
      return { bg: colors.dangerSoft, fg: colors.danger, label: "Missing" };
  }
}

export function ToolboxScreen() {
  const tabBar = useBottomTabBarHeight();

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <Text style={[typography.caption, styles.kicker]}>Assigned to you</Text>
      <Text style={[typography.title, styles.title]}>Toolbox</Text>
      <Text style={[typography.bodySm, styles.sub]}>Scan to check out / in (placeholder).</Text>

      <PrimaryButton
        label="Scan tool (coming soon)"
        variant="ghost"
        onPress={() => {}}
        style={styles.scan}
      />

      {MOCK_TOOLS.map((t) => {
        const st = toolStatusStyle(t.status);
        return (
          <Card key={t.id} style={styles.card}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, styles.name]}>{t.name}</Text>
                <Text style={[typography.caption, styles.tag]}>{t.assetTag}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: st.bg }]}>
                <Text style={[typography.micro, { color: st.fg }]}>{st.label}</Text>
              </View>
            </View>
          </Card>
        );
      })}
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1 },
  title: { color: colors.textPrimary, marginTop: 4 },
  sub: { color: colors.textSecondary, marginTop: space.sm, marginBottom: space.md },
  scan: { marginBottom: space.lg },
  card: { marginBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { color: colors.textPrimary },
  tag: { color: colors.textTertiary, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
