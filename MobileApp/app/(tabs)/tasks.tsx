import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { listMyTasks, type Task } from "@/lib/api/tasks";
import { Screen } from "@/components/Screen";

type TabKey = "mine" | "completed";

function priorityColor(p: string | undefined, colors: ReturnType<typeof useTheme>["colors"]): string {
  if (p === "critical") return colors.danger;
  if (p === "high") return "#F97316";
  if (p === "medium") return "#F2BB05";
  return colors.muted;
}

function isOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return new Date(due) < new Date();
}

function fmtDue(due: string | null | undefined): string {
  if (!due) return "No due date";
  const d = new Date(due);
  if (isOverdue(due)) {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return days === 0 ? "Due today" : `${days}d overdue`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TasksScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("mine");
  const [rows, setRows] = useState<Task[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRows(await listMyTasks(session.token));
    } catch {
      setRows([]);
    }
  }, [session]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = useMemo(() => rows.filter((r) => r.status !== "done"), [rows]);
  const completed = useMemo(() => rows.filter((r) => r.status === "done"), [rows]);
  const list = tab === "completed" ? completed : mine;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Tasks</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body, marginBottom: spacing.lg }}>
          Work orders, PMs, and routines assigned to you.
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.lg }}>
          {[
            { key: "mine" as const, label: `Open (${mine.length})` },
            { key: "completed" as const, label: `Completed (${completed.length})` },
          ].map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 999,
                  alignItems: "center",
                  backgroundColor: active ? colors.success : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.success : colors.border,
                }}
              >
                <Text style={{ color: active ? "#0A0A0A" : colors.muted, fontWeight: "900", fontSize: 12 }}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: spacing.sm }}>
          {list.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20 }}>
              {tab === "completed" ? "No completed tasks yet." : "Nothing assigned right now."}
            </Text>
          ) : null}
          {list.map((t) => {
            const overdue = isOverdue(t.due_date);
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push({ pathname: "/task-detail", params: { id: t.id } } as never)}
                style={{
                  backgroundColor: colors.card,
                  borderColor: overdue ? "rgba(235,81,96,0.4)" : colors.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15, flex: 1 }} numberOfLines={2}>
                    {t.title}
                  </Text>
                  {t.priority ? (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: priorityColor(String(t.priority), colors) + "22",
                        borderWidth: 1,
                        borderColor: priorityColor(String(t.priority), colors) + "55",
                      }}
                    >
                      <Text
                        style={{
                          color: priorityColor(String(t.priority), colors),
                          fontWeight: "900",
                          fontSize: 10,
                          textTransform: "uppercase",
                        }}
                      >
                        {String(t.priority)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: overdue ? colors.danger : colors.muted, marginTop: 6, fontSize: 12, fontWeight: "800" }}>
                  {overdue ? "⚠ " : ""}
                  {fmtDue(t.due_date)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "mine" ? (
          <Pressable
            onPress={() => router.push("/new-work-request" as never)}
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.success,
              borderRadius: radii.lg,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>+ Create work request</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

