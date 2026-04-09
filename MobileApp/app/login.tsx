import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { useSession } from "@/store/session";
import { useTheme } from "@/theme/ThemeProvider";

export default function LoginScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const { colors, radii, spacing, text } = useTheme();
  const { session, authReady, signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiConfigured = Boolean((process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim());
  const contentPadTop = Math.round(windowHeight * 0.12);

  const onSubmit = useCallback(async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    if (!e) {
      setError("Enter your email");
      return;
    }
    if (!password) {
      setError("Enter your password");
      return;
    }
    if (!apiConfigured) {
      setError("Set EXPO_PUBLIC_API_BASE_URL to your Pulse API (same host as the web app).");
      return;
    }
    setBusy(true);
    try {
      await signIn(e, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }, [apiConfigured, email, password, signIn]);

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
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.lg,
            paddingTop: contentPadTop,
            paddingBottom: spacing.xl + 120,
          }}
        >
          <Text style={{ color: colors.text, ...text.h1 }}>Pulse</Text>
          <Text style={{ color: colors.muted, marginTop: spacing.sm, ...text.body }}>
            Sign in with the same email and password as the web app.
          </Text>

          {!apiConfigured ? (
          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              borderRadius: radii.md,
              backgroundColor: "rgba(235,81,96,0.15)",
              borderWidth: 1,
              borderColor: "rgba(235,81,96,0.35)",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>API URL missing</Text>
            <Text style={{ color: colors.muted, marginTop: 6, ...text.small }}>
              Add EXPO_PUBLIC_API_BASE_URL in `.env` (e.g. https://your-api.example.com) and restart Expo.
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Text style={{ color: colors.muted, ...text.small }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@company.com"
            placeholderTextColor={colors.muted}
            editable={!busy}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 14,
              color: colors.text,
              backgroundColor: "rgba(0,0,0,0.2)",
            }}
          />
          <Text style={{ color: colors.muted, ...text.small }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            editable={!busy}
            onSubmitEditing={() => void onSubmit()}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: 14,
              color: colors.text,
              backgroundColor: "rgba(0,0,0,0.2)",
            }}
          />
        </View>

        {error ? (
          <Text style={{ color: colors.danger, marginTop: spacing.md, fontWeight: "600" }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={() => void onSubmit()}
          disabled={busy}
          style={({ pressed }) => ({
            marginTop: spacing.xl,
            paddingVertical: 16,
            borderRadius: radii.md,
            backgroundColor: colors.success,
            alignItems: "center",
            opacity: busy ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={{ color: "#0a0a0a", fontWeight: "800", fontSize: 16 }}>Sign in</Text>
          )}
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
