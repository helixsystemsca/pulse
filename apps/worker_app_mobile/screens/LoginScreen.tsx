import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ActionButton } from "@/components/ActionButton";
import { useAppStore } from "@/store/useAppStore";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";

export function LoginScreen() {
  const login = useAppStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>Helix Field</Text>
        <Text style={styles.tag}>Worker</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textTertiary}
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
        />

        {err ? <Text style={styles.err}>{err}</Text> : null}

        <ActionButton
          label={busy ? "Signing in…" : "Sign in"}
          onPress={() => void onSubmit()}
          variant="primary"
          disabled={busy || !email.trim() || password.length < 8}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: "center",
  },
  inner: {
    paddingHorizontal: layout.screenPaddingH,
    gap: space.md,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "900",
  },
  tag: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: space.lg,
  },
  input: {
    minHeight: layout.minTap,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 17,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  err: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: "600",
  },
});
