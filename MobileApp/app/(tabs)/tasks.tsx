import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type TaskRow = { id: string; title: string; status: "open" | "in_progress" | "completed" };

export default function TasksScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<TaskRow[]>([
    { id: "w1", title: "Cooling pump skid 7 — seal leak", status: "open" },
    { id: "w2", title: "Sprinkler riser — quarterly documentation", status: "in_progress" },
    { id: "w3", title: "CO₂ tank — inspect regulator", status: "open" },
  ]);

  const open = useMemo(() => rows.filter((r) => r.status !== "completed"), [rows]);

  const setStatus = (id: string, st: TaskRow["status"]) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: st } : r)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Tasks</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Assigned work orders, PMs, and inspections.
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {open.map((t) => (
            <View
              key={t.id}
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
                Status: {t.status.replace("_", " ")}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => setStatus(t.id, "in_progress")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: radii.md,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Start</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStatus(t.id, "completed")}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: radii.md,
                    backgroundColor: colors.success,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>Complete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text, ...text.h2 }}>Add note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Notes (optional)…"
            placeholderTextColor={colors.muted}
            style={{
              marginTop: spacing.sm,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.lg,
              padding: spacing.md,
              color: colors.text,
              minHeight: 90,
              textAlignVertical: "top",
            }}
            multiline
          />
          <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>
            Photo attachments are scaffolded — wire to your existing upload endpoints next.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

