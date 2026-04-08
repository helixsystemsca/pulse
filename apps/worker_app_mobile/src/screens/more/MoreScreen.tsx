import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MOCK_PROJECTS } from "@/data/mockProjects";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { usePermissions } from "@/hooks/usePermissions";
import { useSessionStore } from "@/store/useSessionStore";
import { colors, radius, space, typography } from "@/utils/designTokens";
import type { MoreStackParamList } from "@/types/navigation";

type Nav = NativeStackNavigationProp<MoreStackParamList, "MoreMain">;

export function MoreScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation<Nav>();
  const user = useSessionStore((s) => s.user);
  const logout = useSessionStore((s) => s.logout);
  const perms = usePermissions();

  const projects = perms.viewAllProjects ? MOCK_PROJECTS : MOCK_PROJECTS.slice(0, 1);

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <Text style={[typography.title, styles.title]}>More</Text>

      <Card style={styles.profile}>
        <Text style={[typography.subtitle, styles.name]}>{user?.displayName}</Text>
        <Text style={[typography.bodySm, styles.email]}>{user?.email}</Text>
        <View style={styles.rolePill}>
          <Text style={[typography.micro, styles.roleText]}>{user?.role?.toUpperCase()}</Text>
        </View>
      </Card>

      <Text style={[typography.subtitle, styles.section]}>Projects</Text>
      {!perms.viewAllProjects ? (
        <Text style={[typography.bodySm, styles.hint]}>
          Showing assigned project only. Managers and admins see the full portfolio.
        </Text>
      ) : null}

      {projects.map((p) => (
        <Pressable key={p.id} onPress={() => nav.navigate("ProjectDetail", { projectId: p.id })}>
          <Card style={styles.proj}>
            <Text style={[typography.subtitle, styles.projName]}>{p.name}</Text>
            <Text style={[typography.caption, styles.projStatus]}>{p.statusLabel}</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFg, { width: `${p.progressPct}%` }]} />
            </View>
            <Text style={[typography.micro, styles.pct]}>{p.progressPct}% complete</Text>
          </Card>
        </Pressable>
      ))}

      <PrimaryButton label="Sign out" variant="ghost" onPress={() => void logout()} style={styles.out} />
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, marginBottom: space.lg },
  profile: { marginBottom: space.lg },
  name: { color: colors.textPrimary },
  email: { color: colors.textSecondary, marginTop: 4 },
  rolePill: {
    alignSelf: "flex-start",
    marginTop: space.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  roleText: { color: colors.accent },
  section: { color: colors.textPrimary, marginBottom: space.sm },
  hint: { color: colors.textSecondary, marginBottom: space.md, lineHeight: 20 },
  proj: { marginBottom: space.md },
  projName: { color: colors.textPrimary },
  projStatus: { color: colors.textTertiary, marginTop: 4 },
  barBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderSubtle,
    marginTop: space.md,
    overflow: "hidden",
  },
  barFg: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  pct: { color: colors.textTertiary, marginTop: 6 },
  out: { marginTop: space.lg },
});
