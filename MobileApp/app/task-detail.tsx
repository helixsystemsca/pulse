import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { completeTask, getTaskFull, type TaskFullPayload } from "@/lib/api/tasks";

export default function TaskDetailScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const router = useRouter();
  const rawId = useLocalSearchParams<{ id?: string }>().id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { session } = useSession();
  const token = session?.token ?? "";

  const [data, setData] = useState<TaskFullPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setErr(null);
    try {
      const row = await getTaskFull(token, String(id));
      setData(row);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Failed to load task");
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const t = data?.task;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {!token ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.muted }}>Sign in to view this task.</Text>
        </View>
      ) : !data && !err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.success} />
        </View>
      ) : err ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Could not load task</Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>{err}</Text>
          <Pressable onPress={() => void load()} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.success, fontWeight: "800" }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 48 }}>
          <Text style={{ color: colors.text, ...text.h1 }} numberOfLines={3}>
            {t?.title}
          </Text>
          {t?.due_date ? (
            <Text style={{ color: colors.muted, marginTop: 8, fontWeight: "700" }}>
              Due {new Date(t.due_date).toLocaleString()}
            </Text>
          ) : null}
          {t?.description ? (
            <Text style={{ color: colors.text, marginTop: spacing.md, ...text.body }}>{t.description}</Text>
          ) : null}

          {data?.work_order ? (
            <View
              style={{
                marginTop: spacing.lg,
                padding: spacing.md,
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>Work order</Text>
              <Text style={{ color: colors.muted, marginTop: 6, fontWeight: "700" }}>
                {data.work_order.status} · {data.work_order.priority}
              </Text>
              {data.work_order.description ? (
                <Text style={{ color: colors.text, marginTop: spacing.sm }}>{data.work_order.description}</Text>
              ) : null}
            </View>
          ) : null}

          {data?.procedures?.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ color: colors.text, fontWeight: "900", marginBottom: spacing.sm }}>Procedures</Text>
              {data.procedures.map((p) => (
                <View
                  key={p.id}
                  style={{
                    marginBottom: spacing.sm,
                    padding: spacing.md,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>{p.title}</Text>
                  {Array.isArray(p.steps) && p.steps.length ? (
                    <Text style={{ color: colors.muted, marginTop: 6, fontSize: 13 }}>
                      {p.steps.length} step{p.steps.length === 1 ? "" : "s"}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {data?.parts?.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ color: colors.text, fontWeight: "900", marginBottom: spacing.sm }}>Parts</Text>
              {data.parts.map((p) => (
                <Text key={`${p.part_id}-${p.quantity}`} style={{ color: colors.text, marginBottom: 4 }}>
                  {p.name ?? p.part_id} × {p.quantity}
                </Text>
              ))}
            </View>
          ) : null}

          {data?.attachments?.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ color: colors.text, fontWeight: "900", marginBottom: spacing.sm }}>Attachments</Text>
              <Text style={{ color: colors.muted }}>{data.attachments.length} file(s) — open on web for downloads.</Text>
            </View>
          ) : null}

          {data?.equipment_history?.length ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ color: colors.text, fontWeight: "900", marginBottom: spacing.sm }}>Recent on this equipment</Text>
              {data.equipment_history.map((h) => (
                <Text key={h.id} style={{ color: colors.text, marginBottom: 6 }} numberOfLines={2}>
                  {h.title} · {h.status}
                </Text>
              ))}
            </View>
          ) : null}

          {t?.status !== "done" ? (
            <Pressable
              disabled={busy}
              onPress={() => {
                if (!session || !t) return;
                setBusy(true);
                void (async () => {
                  try {
                    await completeTask(session.token, t.id);
                    Alert.alert("Done", "Task completed.", [{ text: "OK", onPress: () => router.back() }]);
                  } catch (e) {
                    Alert.alert("Complete", e instanceof Error ? e.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              style={{
                marginTop: spacing.xl,
                backgroundColor: colors.success,
                paddingVertical: 14,
                borderRadius: radii.lg,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>{busy ? "Saving…" : "Mark complete"}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
