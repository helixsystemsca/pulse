import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { Href } from "expo-router";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { expandLoginEmail, isEmailShape, validateIdentifier } from "@/lib/authIdentifier";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme/ThemeProvider";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgba(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export default function LoginScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { colors, radii, spacing, text } = useTheme();
  const { session, authReady, signIn } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiConfigured = Boolean((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim());
  const heroPadTop = Math.round(windowHeight * 0.08);

  const onSubmit = useCallback(async () => {
    setError(null);
    const raw = identifier.trim();
    if (!raw) {
      setError("Enter your email or username");
      return;
    }
    if (!validateIdentifier(raw)) {
      setError("Enter a valid email or a username (3+ characters, letters/numbers._- only).");
      return;
    }
    const loginEmail = expandLoginEmail(raw);
    if (!isEmailShape(loginEmail)) {
      setError(
        "Use a full email address, or set EXPO_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN in .env (same value as web NEXT_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN) so short usernames work.",
      );
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!apiConfigured) {
      setError("Set EXPO_PUBLIC_API_BASE_URL to your Pulse API (same origin as web NEXT_PUBLIC_API_URL).");
      return;
    }
    setBusy(true);
    try {
      await signIn(loginEmail, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [apiConfigured, identifier, password, signIn]);

  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.success} />
      </View>
    );
  }

  if (session) {
    return <Redirect href={"/" as Href} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          <ImageBackground
            source={require("../assets/images/panorama.jpg")}
            resizeMode="cover"
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={[
                rgba(colors.background, 0.96),
                rgba("#0b1322", 0.88),
                rgba("#06101d", 0.92),
              ]}
              locations={[0, 0.55, 1]}
              style={{ flex: 1 }}
            >
              {/* subtle concentric rings */}
              <View pointerEvents="none" style={{ position: "absolute", inset: 0, opacity: 0.16 }}>
                {Array.from({ length: 6 }).map((_, i) => {
                  const size = 240 + i * 110;
                  return (
                    <View
                      key={i}
                      style={{
                        position: "absolute",
                        top: "18%",
                        left: "50%",
                        width: size,
                        height: size,
                        marginLeft: -size / 2,
                        borderRadius: size / 2,
                        borderWidth: 1,
                        borderColor: rgba("#D7E3FF", 0.55),
                        opacity: 0.22,
                      }}
                    />
                  );
                })}
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingTop: heroPadTop,
                  paddingBottom: spacing.xl,
                  justifyContent: "space-between",
                }}
              >
                {/* hero */}
                <View style={{ alignItems: "center", paddingHorizontal: spacing.lg }}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 22,
                      backgroundColor: rgba(colors.success, 0.22),
                      borderWidth: 1,
                      borderColor: rgba(colors.success, 0.35),
                      alignItems: "center",
                      justifyContent: "center",
                      shadowColor: "#000",
                      shadowOpacity: 0.25,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 12 },
                      elevation: 6,
                    }}
                  >
                    <Image source={require("../assets/images/icon.png")} style={{ width: 42, height: 42 }} />
                  </View>

                  <Text style={{ color: colors.text, marginTop: spacing.md, fontSize: 44, fontWeight: "800" }}>
                    Pulse
                  </Text>

                  <View
                    style={{
                      marginTop: spacing.sm,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: rgba("#0b1322", 0.42),
                      borderWidth: 1,
                      borderColor: rgba("#D7E3FF", 0.22),
                    }}
                  >
                    <Text style={{ color: rgba("#D7E3FF", 0.92), fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>
                      OPERATIONS PLATFORM
                    </Text>
                  </View>
                </View>

                {/* bottom frosted card */}
                <View style={{ paddingHorizontal: spacing.lg }}>
                  <BlurView
                    intensity={28}
                    tint="light"
                    style={{
                      borderRadius: 28,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.28)",
                      backgroundColor: "rgba(255,255,255,0.14)",
                      shadowColor: "#000",
                      shadowOpacity: 0.22,
                      shadowRadius: 24,
                      shadowOffset: { width: 0, height: 16 },
                      elevation: 8,
                    }}
                  >
                    <View style={{ padding: spacing.lg }}>
                      <Text
                        style={{
                          color: colors.headerGlassText,
                          fontSize: 28,
                          fontWeight: "800",
                          textAlign: "center",
                          lineHeight: 32,
                        }}
                      >
                        Enhance your daily{"\n"}operations.
                      </Text>
                      <Text
                        style={{
                          color: colors.headerGlassMuted,
                          marginTop: spacing.sm,
                          ...text.body,
                          textAlign: "center",
                        }}
                      >
                        Invite-only access for verified operators.
                      </Text>

                      {!apiConfigured ? (
                        <View
                          style={{
                            marginTop: spacing.md,
                            padding: spacing.md,
                            borderRadius: radii.md,
                            backgroundColor: "rgba(235,81,96,0.13)",
                            borderWidth: 1,
                            borderColor: "rgba(235,81,96,0.22)",
                          }}
                        >
                          <Text style={{ color: rgba(colors.headerGlassText, 0.98), fontWeight: "800" }}>
                            API URL missing
                          </Text>
                          <Text style={{ color: rgba(colors.headerGlassText, 0.8), marginTop: 6, ...text.small }}>
                            Set EXPO_PUBLIC_API_BASE_URL to the same API origin as the web app’s NEXT_PUBLIC_API_URL (no
                            /api/v1 suffix). Restart Expo after changing .env.
                          </Text>
                        </View>
                      ) : null}

                      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            borderRadius: 16,
                            backgroundColor: "rgba(219, 233, 255, 0.78)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.55)",
                            paddingHorizontal: spacing.md,
                            paddingVertical: 12,
                          }}
                        >
                          <Ionicons name="mail-outline" size={20} color={rgba(colors.headerGlassText, 0.7)} />
                          <TextInput
                            value={identifier}
                            onChangeText={setIdentifier}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            placeholder="Work Email"
                            placeholderTextColor={rgba(colors.headerGlassText, 0.55)}
                            editable={!busy}
                            style={{
                              flex: 1,
                              color: rgba(colors.headerGlassText, 0.95),
                              fontWeight: "700",
                              paddingVertical: 6,
                            }}
                          />
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            borderRadius: 16,
                            backgroundColor: "rgba(219, 233, 255, 0.78)",
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.55)",
                            paddingHorizontal: spacing.md,
                            paddingVertical: 12,
                          }}
                        >
                          <Ionicons name="lock-closed-outline" size={20} color={rgba(colors.headerGlassText, 0.7)} />
                          <TextInput
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            textContentType="password"
                            placeholder="Password"
                            placeholderTextColor={rgba(colors.headerGlassText, 0.55)}
                            editable={!busy}
                            onSubmitEditing={() => void onSubmit()}
                            style={{
                              flex: 1,
                              color: rgba(colors.headerGlassText, 0.95),
                              fontWeight: "700",
                              paddingVertical: 6,
                            }}
                          />
                        </View>
                      </View>

                      {error ? (
                        <Text style={{ color: colors.danger, marginTop: spacing.md, fontWeight: "800" }}>{error}</Text>
                      ) : null}

                      <Pressable
                        onPress={() => void onSubmit()}
                        disabled={busy}
                        style={({ pressed }) => ({
                          marginTop: spacing.lg,
                          borderRadius: 999,
                          overflow: "hidden",
                          opacity: busy ? 0.65 : pressed ? 0.92 : 1,
                        })}
                      >
                        <LinearGradient
                          colors={[rgba(colors.background, 0.85), rgba(colors.background, 0.72)]}
                          style={{
                            paddingVertical: 16,
                            paddingHorizontal: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: "rgba(255,255,255,0.22)",
                          }}
                        >
                          {busy ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                              <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 16 }}>Authenticate</Text>
                              <Ionicons name="arrow-forward-outline" size={18} color="#FFFFFF" />
                            </View>
                          )}
                        </LinearGradient>
                      </Pressable>
                    </View>
                  </BlurView>

                  <Text
                    style={{
                      marginTop: spacing.md,
                      color: rgba("#D7E3FF", 0.62),
                      textAlign: "center",
                      ...text.small,
                    }}
                  >
                    Use the same credentials as the web app.
                  </Text>
                </View>
              </ScrollView>
            </LinearGradient>
          </ImageBackground>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
