import { useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWorkRequestListQuery } from "@/hooks/useWorkRequests";
import { useAppStore } from "@/store/useAppStore";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";

type Row = {
  id: string;
  title: string;
  sub: string;
  at: string;
  tier: "critical" | "warning" | "info";
  issueId?: string;
};

export function AlertsInboxScreen() {
  const navigation = useNavigation();
  const feed = useAppStore((s) => s.feedItems);
  const { data } = useWorkRequestListQuery({ limit: 60 });

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const it of data?.items ?? []) {
      if (it.priority === "critical" || it.is_overdue) {
        out.push({
          id: `wr-${it.id}`,
          title: it.title,
          sub: `${it.location_name ?? "Site"} · ${it.display_status}`,
          at: it.updated_at,
          tier: "critical",
          issueId: it.id,
        });
      }
    }
    for (const f of feed) {
      out.push({
        id: f.id,
        title: f.title,
        sub: f.body,
        at: f.at,
        tier: "warning",
      });
    }
    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [data?.items, feed]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={typography.screenTitle}>ALERTS</Text>
      <Text style={typography.greeting}>Inbox</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl }}
        ListEmptyComponent={
          <Text style={styles.empty}>You’re caught up — new alerts appear here and as push notifications.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
            onPress={() => {
              if (item.issueId) {
                (navigation as { navigate: (a: string, b: object) => void }).navigate("Issues", {
                  screen: "IssueDetail",
                  params: { issueId: item.issueId },
                });
              }
            }}
          >
            <View style={styles.cardTop}>
              <View style={[styles.dot, item.tier === "critical" ? styles.dotC : styles.dotW]} />
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.sub} numberOfLines={3}>
              {item.sub}
            </Text>
            <Text style={styles.time}>{new Date(item.at).toLocaleString()}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: layout.screenPaddingH },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  dotC: { backgroundColor: colors.danger },
  dotW: { backgroundColor: colors.warning },
  title: { flex: 1, ...typography.body, fontWeight: "700", color: colors.textPrimary },
  sub: { marginTop: space.xs, ...typography.bodySm, color: colors.textSecondary },
  time: { marginTop: space.sm, ...typography.micro, color: colors.textTertiary },
  empty: { ...typography.bodySm, color: colors.textSecondary, marginTop: space.lg, lineHeight: 22 },
});
