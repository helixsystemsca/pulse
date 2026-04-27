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
    try {
      setRows(await listNotifications(token));
    } catch {
      setRows([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleTap = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(token, n.id).catch(() => {});
      setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, read: true } : r)));
    }
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

        {rows.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>No notifications yet.</Text>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          {rows.map((n, i) => (
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
              {!n.read ? (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginTop: 4 }} />
              ) : null}
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

