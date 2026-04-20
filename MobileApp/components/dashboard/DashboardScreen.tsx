import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Alert, Image, ImageBackground, Pressable, ScrollView, Text, View } from "react-native";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { getOrganization, type Organization } from "@/lib/api/pulse";
import { fetchAuthenticatedImageAsDataUri } from "@/lib/fetchAuthenticatedImageDataUri";
import { uploadProfileAvatar } from "@/lib/api/profileAvatar";
import { loadMyShiftPresence, type MyShiftPresence } from "@/lib/workforcePresence";
import { getNextTask, getUpcomingTasks, type Task } from "@/lib/api/tasks";
import { subscribePulseWs } from "@/lib/realtime/pulseWs";

/** Bundled hero (same asset as web `public/images/panorama.jpg`) until org background from the API is reliable. */
const HOME_HERO_PANORAMA = require("../../assets/images/panorama.jpg") as ImageSourcePropType;

function firstName(full: string | null | undefined): string {
  const s = (full ?? "").trim();
  if (!s) return "there";
  const parts = s.split(/\s+/).filter(Boolean);
  return parts[0] ?? "there";
}

function presenceDotColor(dot: MyShiftPresence["dot"], colors: ReturnType<typeof useTheme>["colors"]): string {
  if (dot === "on_shift") return colors.success;
  if (dot === "scheduled_off") return colors.warning;
  /** Readable on dusk bar */
  return "rgba(255,255,255,0.55)";
}

function Avatar({
  initials,
  onPress,
  colors,
  size = 44,
  imageSource,
  imageReloadKey = 0,
  profileOwnerKey,
}: {
  initials: string;
  onPress?: () => void;
  colors: { surface: string; border: string; text: string; muted: string };
  size?: number;
  imageSource?: ImageSourcePropType | null;
  /** Bumps after a new upload so the same avatar URL still reloads from the server. */
  imageReloadKey?: number;
  /** When the signed-in user changes, remount the bitmap so RN cannot reuse the previous user's cached image. */
  profileOwnerKey?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource, profileOwnerKey]);

  const showPhoto = Boolean(imageSource) && !imageFailed;
  const imageMountKey = `${profileOwnerKey ?? "anon"}-${imageReloadKey}`;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {showPhoto ? (
        <Image
          key={imageMountKey}
          source={imageSource!}
          style={{ width: size, height: size }}
          resizeMode="cover"
          accessibilityLabel="Profile photo"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={{ color: colors.text, fontWeight: "800" }}>{initials}</Text>
      )}
    </Pressable>
  );
}

function formatTaskDue(due: string | null | undefined): string {
  if (!due) return "No due date";
  try {
    return new Date(due).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export function DashboardScreen() {
  const router = useRouter();
  const { colors, spacing, radii, text } = useTheme();
  const { session, refreshProfile } = useSession();
  const token = session?.token ?? "";
  const isFocused = useIsFocused();

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgErr, setOrgErr] = useState<string | null>(null);
  const [brandingKey, setBrandingKey] = useState(0);
  const [headerBgUri, setHeaderBgUri] = useState<string | null>(null);
  const [shiftPresence, setShiftPresence] = useState<MyShiftPresence | null>(null);
  const [avatarReloadKey, setAvatarReloadKey] = useState(0);
  const [avatarPhotoUri, setAvatarPhotoUri] = useState<string | null>(null);
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);
  const [nextTask, setNextTask] = useState<Task | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [tasksErr, setTasksErr] = useState<string | null>(null);

  const loadTaskQueue = useCallback(async () => {
    if (!token) {
      setNextTask(null);
      setUpcomingTasks([]);
      return;
    }
    setTasksErr(null);
    try {
      const [n, u] = await Promise.all([getNextTask(token), getUpcomingTasks(token, 3)]);
      setNextTask(n);
      setUpcomingTasks(u);
    } catch (e) {
      setNextTask(null);
      setUpcomingTasks([]);
      setTasksErr(e instanceof Error ? e.message : "Could not load tasks");
    }
  }, [token]);

  const pickAndUploadAvatar = useCallback(async () => {
    if (!token || avatarUploadBusy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Allow photo access in Settings to set your profile picture.");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setAvatarUploadBusy(true);
    try {
      await uploadProfileAvatar(token, asset.uri, asset.mimeType ?? null, asset.fileName ?? null);
      await refreshProfile();
      setAvatarReloadKey(Date.now());
    } catch (e) {
      Alert.alert("Profile photo", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setAvatarUploadBusy(false);
    }
  }, [token, avatarUploadBusy, refreshProfile]);

  useEffect(() => {
    let cancelled = false;
    if (!token || !isFocused) return;
    void (async () => {
      try {
        const o = await getOrganization(token);
        if (!cancelled) {
          setOrg(o);
          setOrgErr(null);
          setBrandingKey((k) => k + 1);
        }
      } catch (e) {
        if (!cancelled) setOrgErr(e instanceof Error ? e.message : "Failed to load organization");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isFocused]);

  const effectiveCompanyName = useMemo(
    () => (org?.name ?? session?.user.companyName ?? "").trim(),
    [org?.name, session?.user.companyName],
  );

  const effectiveHeaderBgRaw = useMemo(
    () => (org?.background_image_url ?? org?.header_image_url ?? "").trim(),
    [org?.background_image_url, org?.header_image_url],
  );

  useEffect(() => {
    let cancelled = false;
    if (!effectiveHeaderBgRaw || !token) {
      setHeaderBgUri(null);
      return;
    }
    void (async () => {
      try {
        const uri = await fetchAuthenticatedImageAsDataUri(effectiveHeaderBgRaw, token);
        if (cancelled) return;
        setHeaderBgUri(uri);
      } catch {
        if (!cancelled) setHeaderBgUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveHeaderBgRaw, token, brandingKey]);

  const avatarRaw = useMemo(() => (session?.user.avatarUrl ?? "").trim(), [session?.user.avatarUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!avatarRaw || !token) {
      setAvatarPhotoUri(null);
      return;
    }
    void (async () => {
      try {
        const uri = await fetchAuthenticatedImageAsDataUri(avatarRaw, token);
        if (!cancelled) setAvatarPhotoUri(uri);
      } catch {
        if (!cancelled) setAvatarPhotoUri(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avatarRaw, token, session?.user.id, avatarReloadKey]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    if (!token || !isFocused || !session?.user.id) {
      setShiftPresence(null);
      return () => {
        cancelled = true;
      };
    }
    const run = async () => {
      const p = await loadMyShiftPresence(token, session.user.id);
      if (!cancelled) setShiftPresence(p);
    };
    void run();
    interval = setInterval(run, 45_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [token, isFocused, session?.user.id]);

  useEffect(() => {
    if (!token || !isFocused) return;
    void loadTaskQueue();
  }, [token, isFocused, loadTaskQueue]);

  useEffect(() => {
    if (!token || !isFocused) return;
    const unsub = subscribePulseWs(token, (evt) => {
      const t = evt.event_type ?? "";
      if (t.startsWith("gamification.task_")) void loadTaskQueue();
    });
    return unsub;
  }, [token, isFocused, loadTaskQueue]);

  const displayShiftPresence: MyShiftPresence = useMemo(() => {
    if (shiftPresence) return shiftPresence;
    if (token && session?.user.id) {
      return { primaryLabel: "Loading schedule…", detailLine: "", dot: "unknown" };
    }
    return { primaryLabel: "Sign in for schedule", detailLine: "", dot: "unknown" };
  }, [shiftPresence, token, session?.user.id]);

  const headerAvatarColors = useMemo(
    () => ({
      surface: "rgba(255,255,255,0.94)",
      border: "rgba(255,255,255,0.45)",
      text: colors.headerGlassText,
      muted: colors.headerGlassMuted,
    }),
    [colors.headerGlassMuted, colors.headerGlassText],
  );

  /** Zone when on shift; otherwise company name for context. */
  const headerLocationLine = useMemo(() => {
    if (displayShiftPresence.dot === "on_shift" && displayShiftPresence.detailLine) {
      return displayShiftPresence.detailLine;
    }
    return effectiveCompanyName;
  }, [displayShiftPresence.detailLine, displayShiftPresence.dot, effectiveCompanyName]);

  /** Extra schedule detail only when not using detail as location (on-site zone). */
  const headerScheduleDetail = useMemo(() => {
    if (displayShiftPresence.dot === "on_shift") return "";
    return displayShiftPresence.detailLine ?? "";
  }, [displayShiftPresence.detailLine, displayShiftPresence.dot]);

  const greetingName = useMemo(() => firstName(session?.user.fullName ?? null), [session?.user.fullName]);
  const initials = useMemo(() => {
    const full = (session?.user.fullName ?? "").trim();
    if (!full) return "U";
    const parts = full.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase();
  }, [session?.user.fullName]);

  const avatarDisplaySource = useMemo((): ImageSourcePropType | null => {
    if (!avatarPhotoUri) return null;
    return { uri: avatarPhotoUri };
  }, [avatarPhotoUri]);

  const headerBackgroundSource = useMemo((): ImageSourcePropType => {
    if (headerBgUri) return { uri: headerBgUri };
    return HOME_HERO_PANORAMA;
  }, [headerBgUri]);

  /** Header band only — subtle frosted glass; dusk bar with welcome + location (left) and schedule (right). */
  const HEADER_BG_HEIGHT = 178;
  /** Dusk #4C6085 — gradient for bottom bar (~90% opacity feel). */
  const duskBarGradient = ["rgba(76, 96, 133, 0.58)", "rgba(76, 96, 133, 0.9)"] as const;
  const barScheduleText = { color: "#FFFFFF" as const, fontSize: 13, fontWeight: "700" as const, lineHeight: 18 };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          height: HEADER_BG_HEIGHT,
          width: "100%",
          overflow: "hidden",
          borderBottomLeftRadius: radii.lg,
          borderBottomRightRadius: radii.lg,
        }}
      >
        <ImageBackground
          source={headerBackgroundSource}
          style={{ flex: 1, width: "100%", height: "100%" }}
          blurRadius={5}
          resizeMode="cover"
        >
          <BlurView intensity={14} tint="light" style={{ flex: 1, overflow: "hidden" }}>
            <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.14)" }}>
              <View
                style={{
                  position: "absolute",
                  top: spacing.md,
                  right: spacing.lg,
                  zIndex: 2,
                }}
              >
                <Avatar
                  initials={initials}
                  colors={headerAvatarColors}
                  imageSource={avatarDisplaySource}
                  imageReloadKey={avatarReloadKey}
                  profileOwnerKey={session?.user.id}
                  onPress={token ? pickAndUploadAvatar : undefined}
                />
              </View>

              <LinearGradient
                colors={[...duskBarGradient]}
                locations={[0, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                  accessibilityRole="summary"
                  accessibilityLabel={`Hi ${greetingName}. ${headerLocationLine ? `${headerLocationLine}. ` : ""}${displayShiftPresence.primaryLabel}${headerScheduleDetail ? `. ${headerScheduleDetail}` : ""}`}
                >
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 20,
                        fontWeight: "800",
                        lineHeight: 24,
                        letterSpacing: -0.2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      accessibilityRole="header"
                    >
                      Hi, {greetingName}!
                    </Text>
                    {headerLocationLine ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 5,
                          marginTop: 3,
                          minHeight: 18,
                        }}
                      >
                        <FontAwesome
                          name="map-marker"
                          size={13}
                          color="rgba(255,255,255,0.92)"
                          style={{ marginTop: 1 }}
                        />
                        <Text
                          style={{
                            ...barScheduleText,
                            flex: 1,
                            minWidth: 0,
                            color: "rgba(255,255,255,0.92)",
                            fontWeight: "600",
                          }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          accessibilityLabel={
                            displayShiftPresence.dot === "on_shift" ? "Location" : "Organization"
                          }
                        >
                          {headerLocationLine}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexShrink: 0,
                      gap: 6,
                      maxWidth: "40%",
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: presenceDotColor(displayShiftPresence.dot, colors),
                      }}
                    />
                    <Text style={{ ...barScheduleText, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
                      {displayShiftPresence.primaryLabel}
                      {headerScheduleDetail ? (
                        <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600" }}>
                          {` · ${headerScheduleDetail}`}
                        </Text>
                      ) : null}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </BlurView>
        </ImageBackground>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: 110,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.lg,
            padding: spacing.lg,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 }}>NEXT UP</Text>
          {nextTask ? (
            <Pressable
              onPress={() =>
                router.push(`/task-detail?id=${encodeURIComponent(nextTask.id)}` as Href)
              }
              style={{ marginTop: spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel={`Open next task: ${nextTask.title}`}
            >
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", lineHeight: 28 }} numberOfLines={3}>
                {nextTask.title}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 8, fontWeight: "700" }}>
                {formatTaskDue(nextTask.due_date ?? null)} · Priority {nextTask.priority ?? 1}
              </Text>
              <Text style={{ color: colors.success, marginTop: 12, fontWeight: "900" }}>Open details →</Text>
            </Pressable>
          ) : (
            <Text style={{ ...text.body, color: colors.text, marginTop: spacing.sm, fontWeight: "700" }}>
              No assigned tasks right now.
            </Text>
          )}
        </View>

        {upcomingTasks.length ? (
          <>
            <View style={{ height: spacing.md }} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.6, marginBottom: spacing.sm }}>
              COMING UP
            </Text>
            <View style={{ gap: spacing.sm }}>
              {upcomingTasks.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => router.push(`/task-detail?id=${encodeURIComponent(t.id)}` as Href)}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radii.md,
                    padding: spacing.md,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "800" }} numberOfLines={2}>
                    {t.title}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12, fontWeight: "700" }}>
                    {formatTaskDue(t.due_date ?? null)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {tasksErr ? (
          <View
            style={{
              marginTop: spacing.md,
              backgroundColor: "rgba(235,81,96,0.14)",
              borderColor: "rgba(235,81,96,0.35)",
              borderWidth: 1,
              borderRadius: radii.md,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Tasks</Text>
            <Text style={{ marginTop: 4, color: colors.muted }}>{tasksErr}</Text>
          </View>
        ) : null}

        {orgErr ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: "rgba(235,81,96,0.14)",
              borderColor: "rgba(235,81,96,0.35)",
              borderWidth: 1,
              borderRadius: radii.md,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Org load failed</Text>
            <Text style={{ marginTop: 4, color: colors.muted }}>{orgErr}</Text>
          </View>
        ) : null}

        {!token ? (
          <View
            style={{
              marginTop: 14,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderColor: "rgba(255,255,255,0.18)",
              borderWidth: 1,
              borderRadius: radii.md,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Not signed in</Text>
            <Text style={{ marginTop: 4, color: colors.muted }}>
              Set a session token and configure `EXPO_PUBLIC_API_BASE_URL` to load live org/user data.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

