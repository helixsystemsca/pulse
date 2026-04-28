import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { uploadProfileAvatar } from "@/lib/api/profileAvatar";
import { resolveApiUrl } from "@/lib/api/client";
import {
  getMyCertifications,
  getMyGamification,
  getLeaderboard,
  type LeaderboardEntry,
  type WorkerCertification,
  type WorkerGamification,
} from "@/lib/api/gamification";

const CERT_LABELS: Record<string, string> = {
  P1: "Pool Operator 1",
  P2: "Pool Operator 2",
  RO: "Refrigeration Operator",
  FA: "First Aid",
};

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

function xpProgress(g: WorkerGamification): number {
  const xpInLevel = g.total_xp % 100;
  return xpInLevel / 100;
}

function certExpiryColor(days: number | null, colors: ReturnType<typeof useTheme>["colors"]): string {
  if (days === null) return colors.success;
  if (days <= 30) return colors.danger;
  if (days <= 90) return "#F2BB05";
  return colors.success;
}

function resolvedAvatarUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (s.startsWith("/")) return resolveApiUrl(s) ?? s;
  return s;
}

export default function ProfileScreen() {
  const { colors, radii, spacing, toggleMode, mode } = useTheme();
  const { session, signOut, refreshProfile } = useSession();
  const router = useRouter();
  const token = session?.token ?? "";
  const userId = session?.user?.id ?? "";
  const userName = session?.user?.fullName ?? session?.user?.email ?? "";
  const avatarUrl = resolvedAvatarUrl(session?.user?.avatarUrl);

  const [gamification, setGamification] = useState<WorkerGamification | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [certifications, setCertifications] = useState<WorkerCertification[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      const [g, lb, certs] = await Promise.allSettled([
        getMyGamification(token, userId),
        getLeaderboard(token),
        getMyCertifications(token),
      ]);
      if (g.status === "fulfilled") setGamification(g.value);
      if (lb.status === "fulfilled") setLeaderboard(lb.value);
      if (certs.status === "fulfilled") setCertifications(certs.value);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      await uploadProfileAvatar(token, asset.uri, asset.mimeType ?? null, asset.fileName ?? null);
      await refreshProfile();
      Alert.alert("Avatar updated", "Your photo has been updated.");
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  const g = gamification;
  const myRank = leaderboard.find((e) => e.is_me)?.rank ?? g?.rank ?? null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View
        style={{
          alignItems: "center",
          paddingTop: spacing.xl,
          paddingBottom: spacing.lg,
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={handleAvatarUpload} style={{ marginBottom: spacing.md }}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.success }}
            />
          ) : (
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>{initials(userName)}</Text>
            </View>
          )}
          {uploadingAvatar ? (
            <View
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 40,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color={colors.success} />
            </View>
          ) : null}
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: colors.success,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 12 }}>✏️</Text>
          </View>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{userName}</Text>
        <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12, fontWeight: "700" }}>{session?.user?.role}</Text>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {(!g || g.total_xp === 0) ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.lg,
              padding: spacing.xl,
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <Text style={{ fontSize: 36 }}>🏁</Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16, textAlign: "center" }}>
              You're just getting started
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
              Complete your first task to earn XP and start your streak. Your stats will appear here.
            </Text>
            <Pressable
              onPress={() => router.push("/(tabs)/tasks" as never)}
              style={{
                backgroundColor: colors.success,
                borderRadius: radii.lg,
                paddingVertical: 12,
                paddingHorizontal: 24,
              }}
            >
              <Text style={{ color: "#0A0A0A", fontWeight: "900" }}>View my tasks →</Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.lg,
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>LEVEL {g.level}</Text>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>{g.total_xp.toLocaleString()} XP</Text>
              </View>
              {myRank ? (
                <View
                  style={{
                    backgroundColor: "rgba(54,241,205,0.12)",
                    borderRadius: radii.md,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ color: colors.success, fontWeight: "900" }}>#{myRank}</Text>
                </View>
              ) : null}
            </View>
            <View
              style={{ height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${Math.min(100, xpProgress(g) * 100)}%`,
                  backgroundColor: colors.success,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {g.xp_to_next_level} XP to Level {g.level + 1}
            </Text>
            {g.streak_days > 0 ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 18 }}>🔥</Text>
                <Text style={{ color: colors.text, fontWeight: "900" }}>{g.streak_days}-day streak</Text>
              </View>
            ) : null}
            {g.badges.length > 0 ? (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text
                  style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}
                >
                  RECENT BADGES
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {g.badges.slice(0, 6).map((b) => (
                    <View
                      key={b.id}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>⭐ {b.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Pressable
              onPress={() => setShowLeaderboard((v) => !v)}
              style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <Text style={{ color: colors.success, fontWeight: "900" }}>
                {showLeaderboard ? "Hide leaderboard ↑" : "View leaderboard →"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {showLeaderboard && leaderboard.length > 0 ? (
          <View
            style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg }}
          >
            <Text
              style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 12 }}
            >
              LEADERBOARD — THIS MONTH
            </Text>
            {leaderboard.slice(0, 10).map((entry) => (
              <View
                key={entry.user_id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 8,
                  borderTopWidth: entry.rank === 1 ? 0 : 1,
                  borderTopColor: colors.border,
                  backgroundColor: entry.is_me ? "rgba(54,241,205,0.06)" : "transparent",
                  borderRadius: entry.is_me ? radii.md : 0,
                  paddingHorizontal: entry.is_me ? 8 : 0,
                }}
              >
                <Text style={{ color: colors.muted, width: 24, fontWeight: "900", textAlign: "center" }}>
                  {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `${entry.rank}.`}
                </Text>
                <Text
                  style={{
                    color: entry.is_me ? colors.success : colors.text,
                    flex: 1,
                    fontWeight: entry.is_me ? "900" : "700",
                  }}
                >
                  {entry.display_name}
                  {entry.is_me ? " (you)" : ""}
                </Text>
                <Text style={{ color: colors.muted, fontWeight: "800" }}>{entry.total_xp.toLocaleString()} XP</Text>
              </View>
            ))}
          </View>
        ) : null}

        {certifications.length > 0 ? (
          <View
            style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg }}
          >
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 12 }}>
              CERTIFICATIONS
            </Text>
            {certifications.map((cert, i) => {
              const expiryColor = certExpiryColor(cert.days_until_expiry, colors);
              const rawLabel = (cert.label ?? "").trim();
              const label =
                rawLabel && rawLabel.toUpperCase() !== String(cert.code).toUpperCase()
                  ? rawLabel
                  : CERT_LABELS[String(cert.code).toUpperCase()] ?? String(cert.code);
              return (
                <View
                  key={cert.code}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: expiryColor, marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "800" }}>{label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Code: {cert.code}</Text>
                  </View>
                  {cert.expires_at ? (
                    <Text style={{ color: expiryColor, fontSize: 12, fontWeight: "800" }}>
                      {cert.days_until_expiry !== null && cert.days_until_expiry <= 30
                        ? `⚠ ${cert.days_until_expiry}d left`
                        : `Exp ${new Date(cert.expires_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View
          style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" }}
        >
          <Text
            style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, padding: spacing.lg, paddingBottom: 8 }}
          >
            SETTINGS
          </Text>
          {[
            { label: "Notifications", onPress: () => router.push("/notification-settings" as never) },
            { label: "Availability", onPress: () => router.push({ pathname: "/(tabs)/schedule", params: { tab: "availability" } } as never) },
            { label: `Theme: ${mode === "dark" ? "Dark" : "Light"}`, onPress: () => toggleMode() },
          ].map((item, i) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
              <Text style={{ color: colors.muted }}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            Alert.alert("Sign out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => void signOut() },
            ]);
          }}
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: "rgba(235,81,96,0.4)",
            backgroundColor: "rgba(235,81,96,0.08)",
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: "900" }}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
