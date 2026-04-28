import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { listShifts, type ShiftOut } from "@/lib/api/schedule";
import { listMyTasks, type Task } from "@/lib/api/tasks";
import { listNotifications, type AppNotification } from "@/lib/api/notifications";
import { listMyTools, type AssignedTool } from "@/lib/api/tools";
import { subscribePulseWs } from "@/lib/realtime/pulseWs";
import { DashboardHeroHeader } from "./DashboardHeroHeader";

function isoNow() {
  return new Date().toISOString();
}
function isoPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors, radii, spacing } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.lg,
        padding: spacing.lg,
        ...(style ?? {}),
      }}
    >
      {children}
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 10 }}>
      {label}
    </Text>
  );
}

export function DashboardScreen() {
  const { colors, spacing } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const focused = useIsFocused();
  const token = session?.token ?? "";
  const userId = session?.user?.id ?? "";
  const userName = session?.user?.fullName ?? session?.user?.email ?? "";

  const [upcomingShifts, setUpcomingShifts] = useState<ShiftOut[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tools, setTools] = useState<AssignedTool[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !userId) return;
    try {
      const [shifts, myTasks, myTools, notifs] = await Promise.allSettled([
        listShifts(token, { from: isoNow(), to: isoPlus(7) }),
        listMyTasks(token),
        listMyTools(token, userId),
        listNotifications(token),
      ]);
      if (shifts.status === "fulfilled") {
        const mine = shifts.value
          .filter((s) => String(s.assigned_user_id) === String(userId))
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setUpcomingShifts(mine);
      }
      if (myTasks.status === "fulfilled") setTasks(myTasks.value.filter((t) => t.status !== "done").slice(0, 5));
      if (myTools.status === "fulfilled") setTools(myTools.value.slice(0, 3));
      if (notifs.status === "fulfilled") setNotifications(notifs.value.slice(0, 3));
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (focused) void load();
  }, [focused, load]);

  useEffect(() => {
    if (!token) return;
    return subscribePulseWs(token, (evt) => {
      if (
        evt.event_type === "schedule.period_published" ||
        evt.event_type === "maintenance_inference_request" ||
        evt.event_type === "demo_inference_fired"
      ) {
        void load();
      }
    });
  }, [token, load]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const now = Date.now();
  const currentShift = upcomingShifts.find(
    (s) => new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() >= now,
  );
  const nextShift = upcomingShifts.find((s) => new Date(s.starts_at).getTime() > now);
  const activeShift = currentShift ?? nextShift ?? null;

  const topTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const aOver = a.due_date && new Date(a.due_date) < new Date() ? -1 : 0;
        const bOver = b.due_date && new Date(b.due_date) < new Date() ? -1 : 0;
        if (aOver !== bOver) return aOver - bOver;
        const ap = Number(a.priority ?? 1);
        const bp = Number(b.priority ?? 1);
        return bp - ap; // higher number = higher priority
      })
      .slice(0, 3);
  }, [tasks]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
    >
      <View style={{ marginBottom: spacing.lg }}>
        <DashboardHeroHeader greetingName={userName} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
        <View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Today</Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>Overview</Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications" as never)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {unreadCount > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.danger,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.md }}>
        <Pressable
          onPress={() => router.push("/new-work-request" as never)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: "center",
            backgroundColor: colors.success,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "#0A0A0A", fontWeight: "900", fontSize: 12 }}>+ Log issue</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/tasks" as never)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>📋 My tasks</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: "tool" } } as never)}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: "center",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>🔍 Find tool</Text>
        </Pressable>
      </View>

      <SectionCard style={{ marginBottom: spacing.md }}>
        <SectionLabel label="YOUR SHIFT" />
        {activeShift ? (
          <Pressable onPress={() => router.push("/(tabs)/schedule" as never)}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>{fmtDate(activeShift.starts_at)}</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontWeight: "700" }}>
              {fmtTime(activeShift.starts_at)} – {fmtTime(activeShift.ends_at)}
              {activeShift.shift_code ? `  ·  ${activeShift.shift_code}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.success,
                  opacity: currentShift ? 0.9 : 1,
                }}
              />
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: "900" }}>
                {currentShift ? "On shift now" : "Next shift"}
              </Text>
            </View>
          </Pressable>
        ) : (
          <Text style={{ color: colors.muted }}>No upcoming shifts scheduled.</Text>
        )}
      </SectionCard>

      {topTasks.length > 0 ? (
        <SectionCard style={{ marginBottom: spacing.md }}>
          <SectionLabel label="YOUR TASKS" />
          {topTasks.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => router.push("/(tabs)/tasks" as never)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: Number(t.priority ?? 1) >= 3 ? "rgba(242,187,5,0.7)" : colors.border,
                  marginRight: 10,
                  backgroundColor: colors.surface,
                }}
              />
              <Text style={{ color: colors.text, flex: 1, fontWeight: "700" }} numberOfLines={1}>
                {t.title}
              </Text>
              {t.due_date ? (
                <Text style={{ color: new Date(t.due_date) < new Date() ? colors.danger : colors.muted, fontSize: 11 }}>
                  {new Date(t.due_date) < new Date() ? "⚠ Overdue" : fmtDate(t.due_date)}
                </Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable onPress={() => router.push("/(tabs)/tasks" as never)} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.success, fontWeight: "900", fontSize: 13 }}>View all tasks →</Text>
          </Pressable>
        </SectionCard>
      ) : null}

      {tools.length > 0 ? (
        <SectionCard style={{ marginBottom: spacing.md }}>
          <SectionLabel label="YOUR TOOLS" />
          {tools.map((t, i) => (
            <View
              key={t.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  marginRight: 10,
                  backgroundColor:
                    t.status === "online" ? colors.success : t.status === "missing" ? colors.danger : colors.muted,
                }}
              />
              <Text style={{ color: colors.text, flex: 1, fontWeight: "700" }} numberOfLines={1}>
                {t.label}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {t.last_seen_zone ?? (t.status === "missing" ? "Missing" : "No beacon")}
              </Text>
            </View>
          ))}
          <Pressable onPress={() => router.push("/(tabs)/search" as never)} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.success, fontWeight: "900", fontSize: 13 }}>Find tools →</Text>
          </Pressable>
        </SectionCard>
      ) : null}

      {notifications.length > 0 ? (
        <SectionCard style={{ marginBottom: spacing.md }}>
          <SectionLabel label="RECENT" />
          {notifications.map((n, i) => (
            <View
              key={n.id}
              style={{
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                {n.title}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{timeAgo(n.created_at)}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <Pressable
        onPress={() => router.push("/new-work-request" as never)}
        style={{
          position: "absolute",
          bottom: 100,
          right: spacing.lg,
          backgroundColor: colors.success,
          width: 54,
          height: 54,
          borderRadius: 27,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <Text style={{ color: "#0A0A0A", fontSize: 28, fontWeight: "900", lineHeight: 32 }}>+</Text>
      </Pressable>
    </ScrollView>
  );
}

