import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { completeTask, getTaskFull, startTask, type TaskFullPayload } from "@/lib/api/tasks";

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
  const [notes, setNotes] = useState("");
  const [xpToast, setXpToast] = useState<string | null>(null);

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
  const overdue = Boolean(t?.due_date && new Date(t.due_date) < new Date());

  const priorityLabel = useMemo(() => {
    const p = Number(t?.priority ?? 1);
    if (p >= 3) return "Critical";
    if (p === 2) return "High";
    if (p === 1) return "Normal";
    return "Low";
  }, [t?.priority]);

  const priorityColor = useMemo(() => {
    const p = Number(t?.priority ?? 1);
    if (p >= 3) return "rgba(235,81,96,0.18)";
    if (p === 2) return "rgba(242,187,5,0.18)";
    return "rgba(255,255,255,0.06)";
  }, [t?.priority]);

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
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
          <Text style={{ color: colors.text, ...text.h1 }} numberOfLines={3}>
            {t?.title}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: priorityColor,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>{priorityLabel}</Text>
            </View>
            {t?.status ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "900", fontSize: 12 }}>
                  {t.status === "in_progress" ? "In progress" : t.status === "done" ? "Done" : "To do"}
                </Text>
              </View>
            ) : null}
          </View>
          {t?.due_date ? (
            <Text style={{ color: overdue ? colors.danger : colors.muted, marginTop: 8, fontWeight: "700" }}>
              Due {new Date(t.due_date).toLocaleString()}
              {overdue ? "  ·  Overdue" : ""}
            </Text>
          ) : null}
          {t?.description ? (
            <Text style={{ color: colors.text, marginTop: spacing.md, ...text.body }}>{t.description}</Text>
          ) : null}

          <View style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.text, fontWeight: "900", marginBottom: spacing.sm }}>Notes</Text>
            <View
              style={{
                borderRadius: radii.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: spacing.md,
              }}
            >
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note for yourself…"
                placeholderTextColor={colors.muted}
                multiline
                style={{ color: colors.text, minHeight: 84 }}
              />
            </View>
          </View>

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
            <View style={{ marginTop: spacing.xl, gap: 10 }}>
              {t?.status === "todo" ? (
                <Pressable
                  disabled={busy}
                  onPress={() => {
                    if (!session || !t) return;
                    setBusy(true);
                    void (async () => {
                      try {
                        await startTask(session.token, t.id);
                        await load();
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Could not start task");
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingVertical: 14,
                    borderRadius: radii.lg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "900" }}>{busy ? "Saving…" : "Start working"}</Text>
                </Pressable>
              ) : null}

              <Pressable
                disabled={busy}
                onPress={() => {
                  if (!session || !t) return;
                  setBusy(true);
                  void (async () => {
                    try {
                      const result = await completeTask(session.token, t.id);
                      const breakdown = (result as any).xpBreakdown ?? (result as any).xp_breakdown ?? {};
                      const parts = Object.entries(breakdown as Record<string, number>)
                        .filter(([k, v]) => k !== "base" && Number(v) > 0)
                        .map(([k, v]) => `+${v} ${k}`);
                      const msg = `+${result.xp} XP${parts.length ? "  ·  " + parts.join("  ·  ") : ""}`;
                      setXpToast(msg);
                      setTimeout(() => {
                        setXpToast(null);
                        router.back();
                      }, 2500);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Failed to complete task");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
                style={{
                  backgroundColor: colors.success,
                  paddingVertical: 14,
                  borderRadius: radii.lg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>{busy ? "Saving…" : "Mark complete"}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}

      {xpToast ? (
        <View
          style={{
            position: "absolute",
            bottom: 100,
            left: spacing.lg,
            right: spacing.lg,
            backgroundColor: colors.success,
            borderRadius: radii.lg,
            padding: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>{xpToast}</Text>
        </View>
      ) : null}
    </View>
  );
}
