import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "@/components/Screen";
import { useSession } from "@/store/session";
import { completeTask, getUserAnalytics, listMyTasks, type Task } from "@/lib/api/tasks";

export default function TasksScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const [rows, setRows] = useState<Task[]>([]);
  const [xp, setXp] = useState<{ totalXp: number; level: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!session) return;
    void (async () => {
      try {
        const [tasks, analytics] = await Promise.all([
          listMyTasks(session.token),
          getUserAnalytics(session.token, session.user.id),
        ]);
        if (cancelled) return;
        setRows(tasks);
        setXp({ totalXp: analytics.totalXp, level: analytics.level });
      } catch {
        if (!cancelled) {
          setRows([]);
          setXp(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const open = useMemo(() => rows.filter((r) => r.status !== "done"), [rows]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Tasks</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>Assigned work orders, PMs, and routines.</Text>

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
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>
            LEVEL
          </Text>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 4 }}>
            {xp?.level ?? 1}
          </Text>
          <View
            style={{
              marginTop: spacing.md,
              height: 10,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${(((xp?.totalXp ?? 0) % 100) / 100) * 100}%`,
                backgroundColor: "#4C6085",
              }}
            />
          </View>
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12, fontWeight: "800" }}>
            {(xp?.totalXp ?? 0) % 100}/100 XP · {(xp?.totalXp ?? 0)} total
          </Text>
        </View>

        <View style={{ marginTop: spacing.lg }}>
          {open.map((t, i) => (
            <View key={t.id}>
              {i ? <View style={{ height: spacing.sm }} /> : null}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.lg,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{t.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12, fontWeight: "800" }}>
                  Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : "—"}
                </Text>
                <View style={{ flexDirection: "row", marginTop: spacing.md }}>
                  <Pressable
                    disabled={!session || busy === t.id}
                    onPress={() => {
                      if (!session) return;
                      setBusy(t.id);
                      void (async () => {
                        try {
                          const res = await completeTask(session.token, t.id);
                          setRows((prev) => prev.filter((x) => x.id !== t.id));
                          setXp({ totalXp: res.totalXp, level: res.level });
                        } finally {
                          setBusy((v) => (v === t.id ? null : v));
                        }
                      })();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: radii.md,
                      backgroundColor: colors.success,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>
                      {busy === t.id ? "Completing…" : "Complete"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

