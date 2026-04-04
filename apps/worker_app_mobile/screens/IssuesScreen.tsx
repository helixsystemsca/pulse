import { useNavigation } from "@react-navigation/native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { PriorityPill } from "@/components/PriorityPill";
import { useWorkRequestListQuery } from "@/hooks/useWorkRequests";
import { useAppStore } from "@/store/useAppStore";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";

const STATUSES = ["", "open", "in_progress", "completed"] as const;

export function IssuesScreen() {
  const navigation = useNavigation();
  const user = useAppStore((s) => s.user);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [locationQ, setLocationQ] = useState("");

  const listParams = useMemo(
    () => ({
      limit: 100,
      ...(assignedOnly && user?.id ? { assigned_user_id: user.id } : {}),
      ...(status ? { status } : {}),
    }),
    [assignedOnly, user?.id, status],
  );

  const { data, isLoading, isError, refetch } = useWorkRequestListQuery(listParams);

  const rows = useMemo(() => {
    let items = data?.items ?? [];
    const q = locationQ.trim().toLowerCase();
    if (q) {
      items = items.filter((i) => (i.location_name ?? "").toLowerCase().includes(q));
    }
    return items;
  }, [data?.items, locationQ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={typography.screenTitle}>ISSUES</Text>
        <Text style={typography.greeting}>Track & fix</Text>
      </View>

      <View style={styles.filters}>
        <Pressable
          onPress={() => setAssignedOnly((v) => !v)}
          style={[styles.chip, assignedOnly && styles.chipOn]}
        >
          <Text style={[styles.chipTxt, assignedOnly && styles.chipTxtOn]}>Assigned to me</Text>
        </Pressable>
        <FlatList
          horizontal
          data={[...STATUSES]}
          keyExtractor={(s) => s || "all"}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusRow}
          renderItem={({ item: st }) => (
            <Pressable
              onPress={() => setStatus(st)}
              style={[styles.chip, status === st && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, status === st && styles.chipTxtOn]}>
                {st ? st.replace("_", " ") : "All status"}
              </Text>
            </Pressable>
          )}
        />
        <TextInput
          value={locationQ}
          onChangeText={setLocationQ}
          placeholder="Filter by location"
          placeholderTextColor={colors.textTertiary}
          style={styles.locInput}
        />
      </View>

      <Pressable
        style={styles.reportFab}
        onPress={() =>
          (navigation as { navigate: (a: string, b?: object) => void }).navigate("ReportIssue")
        }
      >
        <Text style={styles.reportFabTxt}>＋ Report issue</Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: space.lg }} color={colors.accent} />
      ) : isError ? (
        <EmptyState title="Could not load issues" subtitle="Check network and try again." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(i) => i.id}
          refreshing={false}
          onRefresh={() => void refetch()}
          contentContainerStyle={rows.length === 0 ? { flexGrow: 1 } : { paddingBottom: space.xxl }}
          ListEmptyComponent={
            <EmptyState title="No issues match" subtitle="Adjust filters or report a new issue." />
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
              onPress={() =>
                (navigation as { navigate: (a: string, b: object) => void }).navigate("IssueDetail", {
                  issueId: item.id,
                })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <PriorityPill priority={item.priority} />
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {item.location_name ?? "No location"} · {item.display_status}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: layout.screenPaddingH, marginBottom: space.sm },
  filters: { paddingHorizontal: layout.screenPaddingH, marginBottom: space.sm },
  statusRow: { gap: space.xs, paddingVertical: space.xs },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: space.xs,
  },
  chipOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipTxt: { ...typography.caption, color: colors.textSecondary, textTransform: "capitalize" },
  chipTxtOn: { color: colors.accent, fontWeight: "700" },
  locInput: {
    marginTop: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    ...typography.bodySm,
    color: colors.textPrimary,
  },
  reportFab: {
    marginHorizontal: layout.screenPaddingH,
    marginBottom: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  reportFabTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  card: {
    marginHorizontal: layout.screenPaddingH,
    marginBottom: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.card,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  title: { flex: 1, ...typography.body, fontWeight: "700", color: colors.textPrimary },
  meta: { marginTop: space.xs, ...typography.caption, color: colors.textSecondary },
});
