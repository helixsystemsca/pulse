import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "@/components/Screen";

type Zone = { id: string; name: string; x: number; y: number; w: number; h: number };

export default function DrawingsScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const [scale, setScale] = useState(1);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>("z2");

  const zones = useMemo<Zone[]>(
    () => [
      { id: "z1", name: "Garage", x: 20, y: 20, w: 220, h: 120 },
      { id: "z2", name: "Boiler Room", x: 260, y: 40, w: 220, h: 180 },
      { id: "z3", name: "Equipment Storage", x: 40, y: 170, w: 200, h: 140 },
    ],
    [],
  );

  return (
    <Screen>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Drawings</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Read-only floor plans. Pan and zoom, and highlight zones.
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing.md }}>
          <Pressable
            onPress={() => setScale((s) => Math.max(0.6, Number((s - 0.1).toFixed(2))))}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              marginRight: 10,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "900" }}>−</Text>
          </Pressable>
          <Pressable
            onPress={() => setScale((s) => Math.min(2.4, Number((s + 0.1).toFixed(2))))}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderRadius: radii.md,
              backgroundColor: colors.success,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>+</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        horizontal
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}
        showsHorizontalScrollIndicator={false}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingRight: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              width: 560,
              height: 420,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.lg,
              overflow: "hidden",
            }}
          >
            <View style={{ transform: [{ scale }], alignSelf: "flex-start" }}>
              <View style={{ width: 560, height: 420, backgroundColor: colors.surface }}>
                {zones.map((z) => {
                  const selected = z.id === selectedZoneId;
                  return (
                    <Pressable
                      key={z.id}
                      onPress={() => setSelectedZoneId(z.id)}
                      style={{
                        position: "absolute",
                        left: z.x,
                        top: z.y,
                        width: z.w,
                        height: z.h,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: selected ? colors.success : "rgba(255,255,255,0.18)",
                        backgroundColor: selected ? "rgba(54,241,205,0.08)" : "rgba(255,255,255,0.04)",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12, margin: 10 }}>
                        {z.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Tip: Pan with one finger (scroll). Zoom with +/− (pinch can be added later).
            </Text>
          </View>
        </ScrollView>
      </ScrollView>
    </Screen>
  );
}

