import React, { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { TooltipOnboarding, type OnboardingStep } from "@/components/TooltipOnboarding";
import { useOnboardingTargets } from "@/hooks/useOnboardingTargets";
import { Screen } from "@/components/Screen";

export default function HomeScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { targets, onLayoutFor } = useOnboardingTargets();

  const steps = useMemo<OnboardingStep[]>(
    () => [
      { id: "home", title: "This is your dashboard", body: "At a glance: tasks, alerts, and upcoming shifts." },
      {
        id: "tasks",
        title: "View and complete your assigned work",
        body: "Start, complete, and add notes/photos from the Tasks tab.",
        target: targets.tasks,
      },
      {
        id: "schedule",
        title: "Check your upcoming shifts",
        body: "A fast list + calendar feel, optimized for field use.",
        target: targets.schedule,
      },
      {
        id: "toolbox",
        title: "Manage your tools here",
        body: "Check in/out and catch missing tools before it becomes an issue.",
        target: targets.toolbox,
      },
    ],
    [targets.schedule, targets.tasks, targets.toolbox],
  );

  const Card = ({ title, value, hint }: { title: string; value: string; hint?: string }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.lg,
        padding: spacing.lg,
      }}
    >
      <Text style={{ color: colors.muted, ...text.small, letterSpacing: 1, textTransform: "uppercase" }}>{title}</Text>
      <Text style={{ color: colors.text, marginTop: 10, fontSize: 26, fontWeight: "800" }}>{value}</Text>
      {hint ? <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <Text style={{ color: colors.text, ...text.h1 }}>Pulse</Text>
        <Text style={{ color: colors.muted, marginTop: 6, ...text.body }}>
          Field view — fast, focused, and mobile-first.
        </Text>

        <View style={{ marginTop: spacing.lg }}>
          <Card title="Assigned tasks" value="3" hint="1 due soon · 0 overdue" />
          <View style={{ height: spacing.md }} />
          <Card title="Alerts" value="2" hint="Tool issue · Upcoming event" />
          <View style={{ height: spacing.md }} />
          <Card title="Upcoming shifts" value="1" hint="Today 2:00–6:00 PM · Boiler Room" />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text, ...text.h2 }}>Quick actions</Text>
          <View style={{ height: spacing.sm }} />
          <View style={{ flexDirection: "row" }}>
            <Pressable
              onLayout={onLayoutFor("tasks")}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: radii.md,
                backgroundColor: colors.success,
                alignItems: "center",
                marginRight: spacing.sm,
              }}
            >
              <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>Go to tasks</Text>
            </Pressable>
            <Pressable
              onLayout={onLayoutFor("schedule")}
              style={{
                flex: 1,
                paddingVertical: 14,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>View schedule</Text>
            </Pressable>
          </View>
          <View style={{ height: spacing.sm }} />
          <Pressable
            onLayout={onLayoutFor("toolbox")}
            style={{
              paddingVertical: 14,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Open toolbox</Text>
          </Pressable>
        </View>
      </ScrollView>

      <TooltipOnboarding steps={steps} />
    </Screen>
  );
}
