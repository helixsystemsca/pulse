import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type ToolRow = { id: string; name: string; status: "assigned_ok" | "missing" };

export default function ToolboxScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const [tools, setTools] = useState<ToolRow[]>([
    { id: "t1", name: "Hammer drill", status: "assigned_ok" },
    { id: "t2", name: "Thermal camera", status: "assigned_ok" },
    { id: "t3", name: "Impact driver", status: "missing" },
  ]);

  const missing = useMemo(() => tools.filter((t) => t.status === "missing"), [tools]);

  const badge = (st: ToolRow["status"]) =>
    st === "missing"
      ? { bg: "rgba(235,81,96,0.18)", fg: colors.danger, label: "Missing" }
      : { bg: "rgba(54,241,205,0.18)", fg: colors.success, label: "Assigned" };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Toolbox</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Assigned tools, check-in/out, and missing alerts.
        </Text>

        {missing.length ? (
          <View
            style={{
              marginTop: spacing.lg,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
            }}
          >
            <Text style={{ color: colors.danger, fontWeight: "900" }}>Missing tools</Text>
            <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>
              Resolve before end of shift when possible.
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {tools.map((t) => {
            const b = badge(t.status);
            return (
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
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 }} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: b.bg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: b.fg, fontSize: 12, fontWeight: "900" }}>{b.label}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.md }}>
                  <Pressable
                    onPress={() => {}}
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
                    <Text style={{ color: colors.text, fontWeight: "800" }}>Check in</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {}}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: radii.md,
                      backgroundColor: colors.success,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>Check out</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

