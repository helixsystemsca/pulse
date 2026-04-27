# Mobile Phase M5 — Profile + Gamification
# handoff/M5integration.md

## CURSOR PROMPT
"Read handoff/M5integration.md and handoff/contracts.md.
Execute steps in order. Check file exists before creating.
All changes are inside MobileApp/ unless marked backend/.
Commit with message provided."

---

## WHAT EXISTS (do not recreate)
- getUserAnalytics(token, userId) in lib/api/tasks.ts — returns {totalXp, level}
- listMyTasks already fetches XP in tasks.tsx
- useSession() → session.user.{id, full_name, email, avatar_url}
- uploadProfileAvatar in lib/api/profileAvatar.ts
- apiFetch(path, {token}) in lib/api/client.ts
- patchWorkerProfile in lib/api/workers.ts

---

## STEP 1 — Gamification API lib

=== FILE: MobileApp/lib/api/gamification.ts ===

```ts
import { apiFetch } from "./client";

export type WorkerGamification = {
  user_id: string;
  full_name: string | null;
  total_xp: number;
  level: number;
  xp_to_next_level: number;
  streak_days: number;
  badges: Array<{ id: string; label: string; earned_at: string }>;
  rank?: number | null;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  display_name: string;
  total_xp: number;
  level: number;
  is_me: boolean;
};

export type WorkerCertification = {
  code: string;
  label: string;
  expires_at: string | null;
  days_until_expiry: number | null;
};

export async function getMyGamification(token: string, userId: string): Promise<WorkerGamification> {
  // Primary: dedicated gamification endpoint
  // Fallback: getUserAnalytics shape from tasks API
  try {
    return await apiFetch<WorkerGamification>(
      `/api/v1/workers/${encodeURIComponent(userId)}/gamification`,
      { token }
    );
  } catch {
    // Fallback to analytics endpoint
    const analytics = await apiFetch<{ totalXp: number; level: number }>(
      `/api/v1/pulse/workers/${encodeURIComponent(userId)}/analytics`,
      { token }
    );
    return {
      user_id: userId,
      full_name: null,
      total_xp: analytics.totalXp ?? 0,
      level: analytics.level ?? 1,
      xp_to_next_level: 100 - ((analytics.totalXp ?? 0) % 100),
      streak_days: 0,
      badges: [],
      rank: null,
    };
  }
}

export async function getLeaderboard(token: string): Promise<LeaderboardEntry[]> {
  try {
    return await apiFetch<LeaderboardEntry[]>("/api/v1/gamification/leaderboard", { token });
  } catch {
    return [];
  }
}

export async function getMyCertifications(token: string): Promise<WorkerCertification[]> {
  try {
    return await apiFetch<WorkerCertification[]>("/api/v1/workers/me/certifications", { token });
  } catch {
    return [];
  }
}
```

---

## STEP 2 — Profile screen

=== FILE: MobileApp/app/(tabs)/profile.tsx ===

```tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable,
  ScrollView, Text, View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { uploadProfileAvatar } from "@/lib/api/profileAvatar";
import {
  getMyGamification, getLeaderboard, getMyCertifications,
  type WorkerGamification, type LeaderboardEntry, type WorkerCertification,
} from "@/lib/api/gamification";

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.map(p => p[0]!.toUpperCase()).slice(0, 2).join("");
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

export default function ProfileScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session, signOut } = useSession();
  const router = useRouter();
  const token = session?.token ?? "";
  const userId = session?.user?.id ?? "";
  const userName = session?.user?.full_name ?? session?.user?.email ?? "";
  const avatarUrl = session?.user?.avatar_url ?? null;

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

  useEffect(() => { void load(); }, [load]);

  const handleAvatarUpload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      await uploadProfileAvatar(token, result.assets[0].uri);
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
  const myRank = leaderboard.find(e => e.is_me)?.rank ?? g?.rank ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {/* Hero / Avatar */}
      <View style={{
        alignItems: "center", paddingTop: spacing.xl, paddingBottom: spacing.lg,
        backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <Pressable onPress={handleAvatarUpload} style={{ marginBottom: spacing.md }}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: colors.success }}
            />
          ) : (
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border,
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>
                {initials(userName)}
              </Text>
            </View>
          )}
          {uploadingAvatar && (
            <View style={{
              position: "absolute", inset: 0, borderRadius: 40,
              backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
            }}>
              <ActivityIndicator color={colors.success} />
            </View>
          )}
          <View style={{
            position: "absolute", bottom: 0, right: 0,
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: colors.success, alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 12 }}>✏️</Text>
          </View>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{userName}</Text>
        {session?.user?.operational_role && (
          <Text style={{ color: colors.muted, marginTop: 4, fontWeight: "700" }}>
            {session.user.operational_role}
          </Text>
        )}
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>

        {/* Gamification card */}
        {g && (
          <View style={{
            backgroundColor: colors.card, borderColor: colors.border,
            borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 }}>
                  LEVEL {g.level}
                </Text>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>
                  {g.total_xp.toLocaleString()} XP
                </Text>
              </View>
              {myRank && (
                <View style={{
                  backgroundColor: "rgba(54,241,205,0.12)",
                  borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 6,
                }}>
                  <Text style={{ color: colors.success, fontWeight: "900" }}>
                    #{myRank}
                  </Text>
                </View>
              )}
            </View>

            {/* XP progress bar */}
            <View style={{
              height: 8, backgroundColor: colors.surface,
              borderRadius: 4, overflow: "hidden", marginBottom: 8,
            }}>
              <View style={{
                height: "100%",
                width: `${Math.min(100, xpProgress(g) * 100)}%`,
                backgroundColor: colors.success, borderRadius: 4,
              }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {g.xp_to_next_level} XP to Level {g.level + 1}
            </Text>

            {/* Streak */}
            {g.streak_days > 0 && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
              }}>
                <Text style={{ fontSize: 18 }}>🔥</Text>
                <Text style={{ color: colors.text, fontWeight: "900" }}>
                  {g.streak_days}-day streak
                </Text>
              </View>
            )}

            {/* Badges */}
            {g.badges.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 8 }}>
                  RECENT BADGES
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {g.badges.slice(0, 6).map(b => (
                    <View key={b.id} style={{
                      backgroundColor: colors.surface, borderRadius: radii.md,
                      borderWidth: 1, borderColor: colors.border,
                      paddingHorizontal: 10, paddingVertical: 6,
                    }}>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                        ⭐ {b.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setShowLeaderboard(v => !v)}
              style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}
            >
              <Text style={{ color: colors.success, fontWeight: "900" }}>
                {showLeaderboard ? "Hide leaderboard ↑" : "View leaderboard →"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Leaderboard */}
        {showLeaderboard && leaderboard.length > 0 && (
          <View style={{
            backgroundColor: colors.card, borderColor: colors.border,
            borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
          }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 12 }}>
              LEADERBOARD — THIS MONTH
            </Text>
            {leaderboard.slice(0, 10).map(entry => (
              <View key={entry.user_id} style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                paddingVertical: 8,
                borderTopWidth: entry.rank === 1 ? 0 : 1,
                borderTopColor: colors.border,
                backgroundColor: entry.is_me ? "rgba(54,241,205,0.06)" : "transparent",
                borderRadius: entry.is_me ? radii.md : 0,
                paddingHorizontal: entry.is_me ? 8 : 0,
              }}>
                <Text style={{ color: colors.muted, width: 24, fontWeight: "900", textAlign: "center" }}>
                  {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : `${entry.rank}.`}
                </Text>
                <Text style={{ color: entry.is_me ? colors.success : colors.text, flex: 1, fontWeight: entry.is_me ? "900" : "700" }}>
                  {entry.display_name}{entry.is_me ? " (you)" : ""}
                </Text>
                <Text style={{ color: colors.muted, fontWeight: "800" }}>
                  {entry.total_xp.toLocaleString()} XP
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Certifications */}
        {certifications.length > 0 && (
          <View style={{
            backgroundColor: colors.card, borderColor: colors.border,
            borderWidth: 1, borderRadius: radii.lg, padding: spacing.lg,
          }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, marginBottom: 12 }}>
              CERTIFICATIONS
            </Text>
            {certifications.map((cert, i) => {
              const expiryColor = certExpiryColor(cert.days_until_expiry, colors);
              return (
                <View key={cert.code} style={{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}>
                  <View style={{
                    width: 8, height: 8, borderRadius: 4,
                    backgroundColor: expiryColor, marginRight: 10,
                  }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "800" }}>{cert.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {cert.code}
                    </Text>
                  </View>
                  {cert.expires_at && (
                    <Text style={{ color: expiryColor, fontSize: 12, fontWeight: "800" }}>
                      {cert.days_until_expiry !== null && cert.days_until_expiry <= 30
                        ? `⚠ ${cert.days_until_expiry}d left`
                        : `Exp ${new Date(cert.expires_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                      }
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Settings */}
        <View style={{
          backgroundColor: colors.card, borderColor: colors.border,
          borderWidth: 1, borderRadius: radii.lg, overflow: "hidden",
        }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, padding: spacing.lg, paddingBottom: 8 }}>
            SETTINGS
          </Text>
          {[
            { label: "Notifications", onPress: () => {} },
            { label: "Availability", onPress: () => router.push("/(tabs)/schedule" as never) },
            { label: "Theme", onPress: () => {} },
          ].map((item, i) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                padding: spacing.lg,
                borderTopWidth: i === 0 ? 1 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
              <Text style={{ color: colors.muted }}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Sign out */}
        <Pressable
          onPress={() => {
            Alert.alert("Sign out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => { signOut?.(); } },
            ]);
          }}
          style={{
            borderRadius: radii.lg, borderWidth: 1,
            borderColor: "rgba(235,81,96,0.4)",
            backgroundColor: "rgba(235,81,96,0.08)",
            paddingVertical: 14, alignItems: "center",
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: "900" }}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
```

---

## EXECUTION STEPS
1. Create MobileApp/lib/api/gamification.ts
2. Create MobileApp/app/(tabs)/profile.tsx
3. git add -A && git commit -m "feat(mobile/M5): profile screen with gamification, leaderboard, certifications"

---

## VALIDATION
- [ ] Profile tab appears in nav
- [ ] Avatar shows with upload press handler
- [ ] XP level and progress bar render
- [ ] Leaderboard toggles on tap
- [ ] Certifications list shows with expiry color coding
- [ ] Expiring certs (≤30 days) show red warning
- [ ] Settings rows navigate correctly
- [ ] Sign out triggers confirmation alert
- [ ] Graceful fallback if gamification endpoint returns 404

---

## UPDATE handoff/current_state.md
- Add: Mobile M5 — profile screen, gamification XP/level/badges, leaderboard, cert display
- Update Pending: M6 remaining
git add handoff/current_state.md
git commit -m "chore: update current_state after mobile M5"
