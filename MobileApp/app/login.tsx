import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import type { Href } from "expo-router";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { expandLoginEmail, isEmailShape, validateIdentifier } from "@/lib/authIdentifier";
import { useSession } from "@/store/session";
import { useTheme } from "@/theme/ThemeProvider";
import { Screen } from "@/components/Screen";

export default function LoginScreen() {
  const { colors, radii, spacing, text } = useTheme();
  const { session, authReady, signIn } = useSession();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiConfigured = Boolean((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim());

  const loginTitle = useMemo(() => {
    // Keep this aligned with the web app feel: plain, focused, no hero art.
    return "Sign in";
  }, []);

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
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radii.lg,
              padding: spacing.lg,
            }}
          >
            <Text style={{ color: colors.text, ...text.h1, textAlign: "center" }}>Pulse</Text>
            <Text style={{ color: colors.muted, ...text.body, textAlign: "center", marginTop: 6 }}>{loginTitle}</Text>

            {!apiConfigured ? (
              <View
                style={{
                  marginTop: spacing.md,
                  padding: spacing.md,
                  borderRadius: radii.lg,
                  backgroundColor: "rgba(235,81,96,0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(235,81,96,0.22)",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>API URL missing</Text>
                <Text style={{ color: colors.muted, marginTop: 6, ...text.small }}>
                  Set <Text style={{ fontWeight: "900" }}>EXPO_PUBLIC_API_BASE_URL</Text> to the same API origin as the
                  web app’s <Text style={{ fontWeight: "900" }}>NEXT_PUBLIC_API_URL</Text> (no /api/v1 suffix). Restart
                  Expo after changing .env.
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                }}
              >
                <Ionicons name="mail-outline" size={18} color={colors.muted} />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  placeholder="Email"
                  placeholderTextColor={colors.muted}
                  editable={!busy}
                  style={{ flex: 1, color: colors.text, fontWeight: "700", paddingVertical: 6 }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                }}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="password"
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  editable={!busy}
                  onSubmitEditing={() => void onSubmit()}
                  style={{ flex: 1, color: colors.text, fontWeight: "700", paddingVertical: 6 }}
                />
              </View>
            </View>

            {error ? <Text style={{ color: colors.danger, marginTop: spacing.md, fontWeight: "800" }}>{error}</Text> : null}

            <Pressable
              onPress={() => void onSubmit()}
              disabled={busy}
              style={({ pressed }) => ({
                marginTop: spacing.lg,
                borderRadius: 999,
                backgroundColor: colors.success,
                paddingVertical: 14,
                alignItems: "center",
                opacity: busy ? 0.65 : pressed ? 0.92 : 1,
              })}
            >
              {busy ? (
                <ActivityIndicator color="#0A0A0A" />
              ) : (
                <Text style={{ color: "#0A0A0A", fontWeight: "900", fontSize: 15 }}>Sign in</Text>
              )}
            </Pressable>

            <Text style={{ marginTop: spacing.md, color: colors.muted, textAlign: "center", ...text.small }}>
              Use the same credentials as the web app.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
