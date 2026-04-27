# Mobile Phase M1 — Nav Restructure + Home Screen
# handoff/M1integration.md

## CURSOR PROMPT
"Read handoff/M1integration.md and handoff/contracts.md.
Execute steps in order. Check file exists before creating.
This is a React Native / Expo project in MobileApp/.
All changes are inside MobileApp/. Commit with message provided."

---

## WHAT EXISTS (do not recreate)
- apiFetch(path, {token}) in lib/api/client.ts — use this for all API calls
- useSession() → {session} where session.token and session.user.id
- useTheme() → {colors, radii, spacing, text} — use for ALL styling
- Screen component wraps each tab screen
- DashboardScreen.tsx — home screen component, already fetches shift presence + tasks
- Tab layout in app/(tabs)/_layout.tsx — currently 7 tabs

---

## STEP 1 — Restructure tabs to 6

=== MODIFY: MobileApp/app/(tabs)/_layout.tsx ===

Replace the Tabs.Screen list with exactly these 6 screens in order:

```tsx
<Tabs.Screen
  name="index"
  options={{
    title: "Home",
    tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
  }}
/>
<Tabs.Screen name="_ble" options={{ href: null }} />
<Tabs.Screen name="two" options={{ href: null }} />
<Tabs.Screen
  name="tasks"
  options={{
    title: "Tasks",
    tabBarIcon: ({ color }) => <TabBarIcon name="check-square-o" color={color} />,
  }}
/>
<Tabs.Screen
  name="schedule"
  options={{
    title: "Schedule",
    tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
  }}
/>
<Tabs.Screen
  name="documents"
  options={{
    title: "Documents",
    tabBarIcon: ({ color }) => <TabBarIcon name="folder-o" color={color} />,
  }}
/>
<Tabs.Screen
  name="search"
  options={{
    title: "Search",
    tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
  }}
/>
<Tabs.Screen
  name="profile"
  options={{
    title: "Profile",
    tabBarIcon: ({ color }) => <TabBarIcon name="user-o" color={color} />,
  }}
/>
```

Also hide the old procedures and drawings tabs (they move into Documents):
```tsx
<Tabs.Screen name="procedures" options={{ href: null }} />
<Tabs.Screen name="drawings" options={{ href: null }} />
<Tabs.Screen name="toolbox" options={{ href: null }} />
```

---

## STEP 2 — New API lib files

=== FILE: MobileApp/lib/api/notifications.ts ===

```ts
import { apiFetch } from "./client";

export type AppNotification = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export async function listNotifications(token: string): Promise<AppNotification[]> {
  return apiFetch<AppNotification[]>("/api/v1/notifications", { token });
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
    token,
  });
}
```

=== FILE: MobileApp/lib/api/tools.ts ===

```ts
import { apiFetch } from "./client";

export type AssignedTool = {
  id: string;
  label: string;
  mac_address: string;
  type: string;
  last_seen_zone?: string | null;
  last_seen_at?: string | null;
  position_confidence?: number | null;
  status: "online" | "offline" | "missing";
};

export async function listMyTools(token: string, userId: string): Promise<AssignedTool[]> {
  return apiFetch<AssignedTool[]>(
    `/api/v1/ble-devices?assigned_worker_id=${encodeURIComponent(userId)}`,
    { token }
  );
}
```

---

## STEP 3 — Rebuild Home screen

=== MODIFY: MobileApp/components/dashboard/DashboardScreen.tsx ===

ACTION: replace entire file with rebuilt version that pulls real data
and shows 4 cards: Shift, Assignments, Tools (max 3), Notifications (max 3)

```tsx
import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { listShifts, type ShiftOut } from "@/lib/api/schedule";
import { listMyTasks, type Task } from "@/lib/api/tasks";
import { listNotifications, type AppNotification } from "@/lib/api/notifications";
import { listMyTools, type AssignedTool } from "@/lib/api/tools";
import { subscribePulseWs } from "@/lib/realtime/pulseWs";

function isoNow() { return new Date().toISOString(); }
function isoPlus(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString();
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
    <View style={{
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      ...style,
    }}>
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
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const focused = useIsFocused();
  const token = session?.token ?? "";
  const userId = session?.user?.id ?? "";
  const userName = session?.user?.full_name ?? session?.user?.email ?? "";

  const [upcomingShift, setUpcomingShift] = useState<ShiftOut | null>(null);
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
        const mine = shifts.value.filter(s => String(s.assigned_user_id) === String(userId));
        setUpcomingShift(mine[0] ?? null);
      }
      if (myTasks.status === "fulfilled") setTasks(myTasks.value.filter(t => t.status !== "done").slice(0, 5));
      if (myTools.status === "fulfilled") setTools(myTools.value.slice(0, 3));
      if (notifs.status === "fulfilled") setNotifications(notifs.value.slice(0, 3));
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => { if (focused) void load(); }, [focused, load]);

  // WebSocket — re-fetch on inference or schedule events
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

  const firstName = userName.trim().split(/\s+/)[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
        <View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{greeting}</Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>{firstName}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications" as never)}
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.border,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 18 }}>🔔</Text>
          {unreadCount > 0 && (
            <View style={{
              position: "absolute", top: 4, right: 4,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: colors.danger,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* YOUR SHIFT */}
      <SectionCard style={{ marginBottom: spacing.md }}>
        <SectionLabel label="YOUR SHIFT" />
        {upcomingShift ? (
          <Pressable onPress={() => router.push("/(tabs)/schedule" as never)}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "900" }}>
              {fmtDate(upcomingShift.starts_at)}
            </Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontWeight: "700" }}>
              {fmtTime(upcomingShift.starts_at)} – {fmtTime(upcomingShift.ends_at)}
              {upcomingShift.shift_code ? `  ·  ${upcomingShift.shift_code}` : ""}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: "900" }}>Upcoming</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={{ color: colors.muted }}>No upcoming shifts scheduled.</Text>
        )}
      </SectionCard>

      {/* YOUR TASKS */}
      {tasks.length > 0 && (
        <SectionCard style={{ marginBottom: spacing.md }}>
          <SectionLabel label="YOUR TASKS" />
          {tasks.map((t, i) => (
            <Pressable
              key={t.id}
              onPress={() => router.push("/(tabs)/tasks" as never)}
              style={{
                flexDirection: "row", alignItems: "center",
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{
                width: 18, height: 18, borderRadius: 4,
                borderWidth: 1.5, borderColor: colors.border,
                marginRight: 10, backgroundColor: colors.surface,
              }} />
              <Text style={{ color: colors.text, flex: 1, fontWeight: "700" }} numberOfLines={1}>
                {t.title}
              </Text>
              {t.due_date && (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {new Date(t.due_date) < new Date() ? "⚠ Overdue" : fmtDate(t.due_date)}
                </Text>
              )}
            </Pressable>
          ))}
          <Pressable onPress={() => router.push("/(tabs)/tasks" as never)} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.success, fontWeight: "900", fontSize: 13 }}>View all tasks →</Text>
          </Pressable>
        </SectionCard>
      )}

      {/* YOUR TOOLS */}
      {tools.length > 0 && (
        <SectionCard style={{ marginBottom: spacing.md }}>
          <SectionLabel label="YOUR TOOLS" />
          {tools.map((t, i) => (
            <View key={t.id} style={{
              flexDirection: "row", alignItems: "center",
              paddingVertical: 8,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}>
              <View style={{
                width: 8, height: 8, borderRadius: 4, marginRight: 10,
                backgroundColor: t.status === "online" ? colors.success
                  : t.status === "missing" ? colors.danger : colors.muted,
              }} />
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
      )}

      {/* NOTIFICATIONS */}
      {notifications.length > 0 && (
        <SectionCard style={{ marginBottom: spacing.md }}>
          <SectionLabel label="RECENT" />
          {notifications.map((n, i) => (
            <View key={n.id} style={{
              paddingVertical: 8,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}>
              <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>{n.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{timeAgo(n.created_at)}</Text>
            </View>
          ))}
        </SectionCard>
      )}

      {/* Log work request FAB */}
      <Pressable
        onPress={() => router.push("/new-work-request" as never)}
        style={{
          position: "absolute", bottom: 100, right: spacing.lg,
          backgroundColor: colors.success,
          width: 54, height: 54, borderRadius: 27,
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
        }}
      >
        <Text style={{ color: "#0A0A0A", fontSize: 28, fontWeight: "900", lineHeight: 32 }}>+</Text>
      </Pressable>
    </ScrollView>
  );
}
```

---

## STEP 4 — Notifications screen

=== FILE: MobileApp/app/notifications.tsx ===

```tsx
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { listNotifications, markNotificationRead, type AppNotification } from "@/lib/api/notifications";
import { Screen } from "@/components/Screen";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();
  const token = session?.token ?? "";

  const [rows, setRows] = useState<AppNotification[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try { setRows(await listNotifications(token)); } catch { setRows([]); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleTap = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(token, n.id).catch(() => {});
      setRows(prev => prev.map(r => r.id === n.id ? { ...r, read: true } : r));
    }
    // Deep link routing
    const to = n.metadata?.to as string | undefined;
    if (to) router.push(to as never);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, gap: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.success, fontWeight: "900", fontSize: 16 }}>←</Text>
          </Pressable>
          <Text style={{ color: colors.text, ...text.h1 }}>Notifications</Text>
        </View>

        {rows.length === 0 && (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
            No notifications yet.
          </Text>
        )}

        <View style={{ gap: spacing.sm }}>
          {rows.map(n => (
            <Pressable
              key={n.id}
              onPress={() => void handleTap(n)}
              style={{
                backgroundColor: n.read ? colors.card : colors.surface,
                borderColor: n.read ? colors.border : colors.success,
                borderWidth: 1,
                borderRadius: radii.lg,
                padding: spacing.lg,
                flexDirection: "row",
                gap: 12,
              }}
            >
              {!n.read && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginTop: 4 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>{n.title}</Text>
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13 }}>{n.body}</Text>
                <Text style={{ color: colors.muted, marginTop: 6, fontSize: 11 }}>{timeAgo(n.created_at)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
```

---

## STEP 5 — New work request quick-create screen

=== FILE: MobileApp/app/new-work-request.tsx ===

```tsx
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { createWorkRequest } from "@/lib/api/workRequests";
import { Screen } from "@/components/Screen";

export default function NewWorkRequestScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [busy, setBusy] = useState(false);

  const PRIORITIES = ["low", "medium", "high", "critical"] as const;
  const PRIORITY_COLORS: Record<string, string> = {
    low: "#6B7280", medium: "#F2BB05", high: "#F97316", critical: "#EF4444",
  };

  const submit = async () => {
    if (!session || !title.trim()) return;
    setBusy(true);
    try {
      await createWorkRequest(session.token, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });
      Alert.alert("Work request created", "Your request has been submitted.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContain