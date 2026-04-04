import { useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { PriorityPill } from "@/components/PriorityPill";
import { useWorkRequestListQuery } from "@/hooks/useWorkRequests";
import { useAppStore } from "@/store/useAppStore";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";

export function DashboardScreen() {
  const navigation = useNavigation();
  const user = useAppStore((s) => s.user);
  const { data, isLoading, isError, refetch, isRefetching } = useWorkRequestListQuery({ limit: 40 });

  const openIssues = useMemo(
    () => (data?.items ?? []).filter((i) => i.status !== "completed" && i.status !== "cancelled"),
    [data?.items],
  );
  const mine = useMemo(
    () => openIssues.filter((i) => i.assigned_user_id === user?.id).slice(0, 5),
    [openIssues, user?.id],
  );
  const criticalAlerts = useMemo(
    () => openIssues.filter((i) => i.priority === "critical" || i.is_overdue).slice(0, 4),
    [openIssues],
  );

  const systemOk = openIssues.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={typography.screenTitle}>FIELD OVERVIEW</Text>
            <Text style={typography.greeting} numberOfLines={1}>
              Hi{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={() => void refetch()}
            style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.refreshTxt}>{isRefetching ? "…" : "Refresh"}</Text>
          </Pressable>
        </View>

        <View style={[styles.statusHero, systemOk ? styles.heroOk : styles.heroWarn]}>
          <Text style={styles.heroTitle}>{systemOk ? "All clear" : "Attention needed"}</Text>
          <Text style={styles.heroSub}>
            {systemOk
              ? "No open issues right now."
              : `${openIssues.length} open issue${openIssues.length === 1 ? "" : "s"}`}
          </Text>
        </View>

        <Text style={[typography.section, styles.sectionLabel]}>Quick actions</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() =>
              (navigation as { navigate: (a: string, b?: object) => void }).navigate("Issues", {
                screen: "ReportIssue",
              })
            }
          >
            <Text style={styles.actionTitle}>Report issue</Text>
            <Text style={styles.actionSub}>Log a problem fast</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => (navigation as { navigate: (a: string, b?: object) => void }).navigate("Forms")}
          >
            <Text style={styles.actionTitle}>Submit form</Text>
            <Text style={styles.actionSub}>Checklists</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
            onPress={() => (navigation as { navigate: (a: string) => void }).navigate("Alerts")}
          >
            <Text style={styles.actionTitle}>Alerts</Text>
            <Text style={styles.actionSub}>Inbox</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: space.lg }} color={colors.accent} />
        ) : isError ? (
          <EmptyState title="Could not load issues" subtitle="Pull refresh or check connection." />
        ) : null}

        {criticalAlerts.length > 0 ? (
          <>
            <Text style={[typography.section, styles.sectionLabel]}>Priority alerts</Text>
            {criticalAlerts.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.issueCard, pressed && { opacity: 0.92 }]}
                onPress={() =>
                  (navigation as { navigate: (a: string, b: object) => void }).navigate("Issues", {
                    screen: "IssueDetail",
                    params: { issueId: item.id },
                  })
                }
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <PriorityPill priority={item.priority} />
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.location_name ?? "Location TBD"} · {item.display_status}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {mine.length > 0 ? (
          <>
            <Text style={[typography.section, styles.sectionLabel]}>Assigned to you</Text>
            {mine.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.issueCard, pressed && { opacity: 0.92 }]}
                onPress={() =>
                  (navigation as { navigate: (a: string, b: object) => void }).navigate("Issues", {
                    screen: "IssueDetail",
                    params: { issueId: item.id },
                  })
                }
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <PriorityPill priority={item.priority} />
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.location_name ?? "—"} · {item.display_status}
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scroll: {
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: space.xxl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: space.md,
  },
  refresh: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  refreshTxt: { ...typography.caption, color: colors.accent },
  statusHero: {
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
  },
  heroOk: { backgroundColor: colors.successSoft },
  heroWarn: { backgroundColor: colors.warningSoft },
  heroTitle: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  heroSub: { marginTop: 4, ...typography.bodySm, color: colors.textSecondary },
  sectionLabel: { marginTop: space.sm, marginBottom: space.sm, color: colors.textPrimary },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg },
  actionCard: {
    flexGrow: 1,
    minWidth: "28%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  actionPressed: { opacity: 0.9 },
  actionTitle: { ...typography.bodySm, fontWeight: "700", color: colors.textPrimary },
  actionSub: { marginTop: 2, ...typography.caption, color: colors.textTertiary },
  issueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm, alignItems: "flex-start" },
  cardTitle: { flex: 1, ...typography.body, fontWeight: "700", color: colors.textPrimary },
  cardMeta: { marginTop: space.xs, ...typography.caption, color: colors.textSecondary },
});
