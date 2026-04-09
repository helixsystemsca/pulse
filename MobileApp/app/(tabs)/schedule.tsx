import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export default function ScheduleScreen() {
  const { colors, radii, spacing, text } = useTheme();

  const shifts = [
    { id: "s1", when: "Today", time: "2:00–6:00 PM", zone: "Boiler Room" },
    { id: "s2", when: "Fri", time: "8:00 AM–12:00 PM", zone: "Garage · Zone 3" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Schedule</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Your upcoming shifts — fast list with a calendar feel.
        </Text>

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          {shifts.map((s) => (
            <View
              key={s.id}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                padding: spacing.lg,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>
                {s.when}
              </Text>
              <Text style={{ color: colors.text, marginTop: 6, fontSize: 16, fontWeight: "900" }}>{s.time}</Text>
              <Text style={{ color: colors.muted, marginTop: 6, fontSize: 13 }}>{s.zone}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

