import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import {
  listMyProcedureAssignments,
  type ProcedureAssignmentRow,
  type ProcedureAssignmentStatus,
} from "@/lib/api/procedures";

type TabKey = "attention" | "completed";

function statusTone(status: ProcedureAssignmentStatus): "warn" | "ok" {
  if (status === "completed") return "ok";
  return "warn";
}

export default function ProceduresTabScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const token = session?.token ?? "";

  const [tab, setTab] = useState<TabKey>("attention");
  const [rows, setRows] = useState<ProcedureAssignmentRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const list = await listMyProcedureAssignments(token);
      setRows(list);
    } catch (e) {
      setRows([]);
      setErr(e instanceof Error ? e.message : "Failed to load procedures");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const attention = useMemo(
    () => (rows ?? []).filter((r) => r.status === "pending" || r.status === "in_progress"),
    [rows],
  );
  const completed = useMemo(() => (rows ?? []).filter((r) => r.status === "completed"), [rows]);

  const list = tab === "completed" ? completed : attention;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Procedures</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Assigned procedures that need your attention, with photo uploads.
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing.lg }}>
          {([
            { key: "attention", label: `Attention (${attention.length})` },
            { key: "completed", label: `Completed (${completed.length})` },
          ] as const).map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: active ? colors.success : colors.border,
                  backgroundColor: active ? "rgba(54,241,205,0.08)" : colors.surface,
                  marginRight: t.key === "attention" ? spacing.sm : 0,
                }}
              >
                <Text style={{ color: active ? colors.text : colors.muted, fontWeight: "900", fontSize: 12 }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!token ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.muted }}>Sign in to view assignments.</Text>
          </View>
        ) : !rows ? (
          <View style={{ marginTop: 48, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.success} />
          </View>
        ) : err ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>Could not load procedures</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>{err}</Text>
            <Pressable onPress={() => void load()} style={{ marginTop: spacing.lg }}>
              <Text style={{ color: colors.success, fontWeight: "800" }}>Retry</Text>
            </Pressable>
          </View>
        ) : list.length === 0 ? (
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.lg,
              padding: spacing.lg,
            }}
          >
            <Text style={{ color: colors.muted, fontWeight: "800" }}>
              {tab === "completed" ? "No completed procedures yet." : "Nothing assigned right now."}
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg }}>
            {list.map((r, i) => {
              const tone = statusTone(r.status);
              const badgeBg = tone === "ok" ? "rgba(54,241,205,0.12)" : "rgba(242,187,5,0.12)";
              const badgeFg = tone === "ok" ? colors.success : "#F2BB05";
              return (
                <View key={r.id}>
                  {i ? <View style={{ height: spacing.sm }} /> : null}
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/procedure-assignment" as never, params: { id: r.id } } as never)
                    }
                    style={{
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderWidth: 1,
                      borderRadius: radii.lg,
                      padding: spacing.lg,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }} numberOfLines={2}>
                          {r.procedure_title}
                        </Text>
                        <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12, fontWeight: "800" }}>
                          {r.kind === "revise" ? "Revision requested" : r.kind === "create" ? "Create requested" : "Completion requested"}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: badgeBg,
                          borderColor: colors.border,
                          borderWidth: 1,
                        }}
                      >
                        <Text style={{ color: badgeFg, fontSize: 11, fontWeight: "900" }}>
                          {r.status === "in_progress" ? "IN PROGRESS" : r.status === "pending" ? "PENDING" : "DONE"}
                        </Text>
                      </View>
                    </View>
                    {r.notes ? (
                      <Text style={{ color: colors.text, marginTop: spacing.sm, fontSize: 13 }} numberOfLines={3}>
                        {r.notes}
                      </Text>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

