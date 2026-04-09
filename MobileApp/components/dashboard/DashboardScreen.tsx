import { useIsFocused } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ImageSourcePropType } from "react-native";
import { Alert, Image, ImageBackground, Pressable, ScrollView, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/store/session";
import { getOrganization, type Organization } from "@/lib/api/pulse";
import { resolveApiUrl } from "@/lib/api/client";
import { uploadProfileAvatar } from "@/lib/api/profileAvatar";

/** Bundled hero (same asset as web `public/images/panorama.jpg`) until org background from the API is reliable. */
const HOME_HERO_PANORAMA = require("../../assets/images/panorama.jpg") as ImageSourcePropType;

type PresenceStatus = "green" | "amber" | "red";

/** Signed-in fetches for `/api/v1/company/*` paths need the bearer token (RN `Image` does not send cookies). */
function pulseAuthenticatedImageSource(
  raw: string | null | undefined,
  token: string,
): ImageSourcePropType | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const uri = resolveApiUrl(s);
  if (!uri) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) {
    return { uri };
  }
  if (!token) return null;
  return { uri, headers: { Authorization: `Bearer ${token}` } };
}

function firstName(full: string | null | undefined): string {
  const s = (full ?? "").trim();
  if (!s) return "there";
  const parts = s.split(/\s+/).filter(Boolean);
  return parts[0] ?? "there";
}

function statusDotColor(status: PresenceStatus, colors: ReturnType<typeof useTheme>["colors"]) {
  if (status === "green") return colors.success;
  if (status === "amber") return colors.warning;
  return colors.danger;
}

function Avatar({
  initials,
  onPress,
  colors,
  size = 44,
  imageSource,
  imageReloadKey = 0,
}: {
  initials: string;
  onPress?: () => void;
  colors: { surface: string; border: string; text: string; muted: string };
  size?: number;
  imageSource?: ImageSourcePropType | null;
  /** Bumps after a new upload so the same avatar URL still reloads from the server. */
  imageReloadKey?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageSource]);

  const showPhoto = Boolean(imageSource) && !imageFailed;

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
          key={imageReloadKey}
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

function ToolboxCard({
  name,
  line1,
  line2,
  batteryPct,
}: {
  name: string;
  line1: string;
  line2?: string;
  batteryPct?: number;
}) {
  const { colors, radii } = useTheme();
  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.78)",
        borderRadius: radii.md,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: "rgba(76,96,133,0.10)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(76,96,133,0.35)" }} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: "800", color: "#1B2B44" }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ marginTop: 2, color: "#516B90", fontWeight: "700" }} numberOfLines={1}>
          {line1}
        </Text>
        {line2 ? (
          <Text style={{ marginTop: 1, color: "#6B7F9B", fontWeight: "600" }} numberOfLines={1}>
            {line2}
          </Text>
        ) : null}
        {batteryPct != null ? (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                flex: 1,
                height: 4,
                borderRadius: 999,
                backgroundColor: "rgba(27,43,68,0.12)",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.max(0, Math.min(100, batteryPct))}%`,
                  height: 4,
                  backgroundColor: colors.success,
                }}
              />
            </View>
            <Text style={{ color: "#6B7F9B", fontWeight: "700", fontSize: 12 }}>{batteryPct}%</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function DashboardScreen() {
  const { colors, spacing, radii, text } = useTheme();
  const { session, has, refreshProfile } = useSession();
  const token = session?.token ?? "";
  const isFocused = useIsFocused();

  const [org, setOrg] = useState<Organization | null>(null);
  const [orgErr, setOrgErr] = useState<string | null>(null);
  const [brandingKey, setBrandingKey] = useState(0);
  const [avatarReloadKey, setAvatarReloadKey] = useState(0);
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);

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

  // Placeholder presence + zone until backend presence endpoint is wired.
  const presence: PresenceStatus = "green";
  const lastZone = "Garage";

  const greetingName = useMemo(() => firstName(session?.user.fullName ?? null), [session?.user.fullName]);
  const initials = useMemo(() => {
    const full = (session?.user.fullName ?? "").trim();
    if (!full) return "U";
    const parts = full.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return `${a}${b}`.toUpperCase();
  }, [session?.user.fullName]);

  const companyLogoSource = useMemo(
    () => pulseAuthenticatedImageSource(org?.logo_url, token),
    [org?.logo_url, token],
  );

  const avatarDisplaySource = useMemo((): ImageSourcePropType | null => {
    const raw = (session?.user.avatarUrl ?? "").trim();
    if (!raw) return null;
    const uri = resolveApiUrl(raw);
    if (!uri) return null;
    const isAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw);
    if (isAbsolute) {
      return { uri };
    }
    if (token) {
      return { uri, headers: { Authorization: `Bearer ${token}` } };
    }
    return { uri };
  }, [session?.user.avatarUrl, token]);

  // Temporary, mock toolbox content until tools API is aligned to backend.
  const toolbox = [
    { name: "Circular Saw", line1: "Ready · Blade guard", line2: "OK" },
    { name: "Drill", line1: "Charged · 18V pack" },
    { name: "Batteries (×2)", line1: "Charged", batteryPct: 80 },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ImageBackground
        source={HOME_HERO_PANORAMA}
        style={{ flex: 1 }}
        blurRadius={18}
        resizeMode="cover"
      >
        <BlurView intensity={35} tint="dark" style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ color: colors.text, ...text.h1 }}>Hi, {greetingName}!</Text>
                <View style={{ height: 10 }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: statusDotColor(presence, colors),
                    }}
                  />
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>
                    {presence === "green" ? "On-site" : presence === "amber" ? "Not scheduled" : "Needs attention"}
                  </Text>
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>·</Text>
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>{lastZone}</Text>
                </View>
              </View>

              <Avatar
                initials={initials}
                colors={colors}
                imageSource={avatarDisplaySource}
                imageReloadKey={avatarReloadKey}
                onPress={token ? pickAndUploadAvatar : undefined}
              />
            </View>

            {companyLogoSource ? (
              <View style={{ alignItems: "center", marginTop: spacing.md }}>
                <Image
                  key={brandingKey}
                  source={companyLogoSource}
                  style={{ width: 220, height: 64 }}
                  resizeMode="contain"
                  accessibilityLabel="Company logo"
                />
              </View>
            ) : null}

            <View style={{ height: spacing.lg }} />

            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.14)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.16)",
                borderRadius: radii.lg,
                padding: spacing.md,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>Current Toolbox</Text>
                <Text style={{ color: colors.success, fontWeight: "900" }}>View All</Text>
              </View>
            </View>

            <View style={{ height: spacing.sm }} />

            <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
              {(has("module.tool_tracking.read") || true) && (
                <View style={{ gap: 10 }}>
                  {toolbox.map((t) => (
                    <ToolboxCard
                      key={t.name}
                      name={t.name}
                      line1={t.line1}
                      line2={"line2" in t ? (t as any).line2 : undefined}
                      batteryPct={"batteryPct" in t ? (t as any).batteryPct : undefined}
                    />
                  ))}
                </View>
              )}

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
        </BlurView>
      </ImageBackground>
    </View>
  );
}

