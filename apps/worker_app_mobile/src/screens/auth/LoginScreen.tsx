import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useSessionStore } from "@/store/useSessionStore";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";
import type { UserRole } from "@/types/user";

const ROLES: { id: UserRole; label: string }[] = [
  { id: "technician", label: "Technician" },
  { id: "manager", label: "Manager" },
  { id: "admin", label: "Admin" },
];

export function LoginScreen() {
  const login = useSessionStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("technician");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    try {
      await login({
        email: email || "operator@helix.local",
        displayName: name || "Field Operator",
        role,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.hero}>
        <Text style={[typography.title, styles.brand]}>Helix Field</Text>
        <Text style={[typography.bodySm, styles.tag]}>Operations · assignments · tools · site</Text>
      </View>
      <Card style={styles.card}>
        <Text style={[typography.subtitle, styles.label]}>Sign in (demo)</Text>
        <Text style={[typography.caption, styles.hint]}>Mock auth — pick a role to test permissions.</Text>
        <TextInput
          style={styles.input}
          placeholder="Display name"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email (optional)"
          placeholderTextColor={colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={[typography.caption, styles.roleLabel]}>Role</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => {
            const on = role === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => setRole(r.id)}
                style={[styles.roleChip, on && styles.roleChipOn]}
              >
                <Text style={[typography.caption, on ? styles.roleChipTextOn : styles.roleChipText]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton label="Continue" onPress={onSubmit} loading={busy} style={styles.cta} />
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas, justifyContent: "center", padding: layout.screenPaddingH },
  hero: { marginBottom: space.xl },
  brand: { color: colors.textPrimary },
  tag: { color: colors.textSecondary, marginTop: space.sm },
  card: { marginBottom: space.xxl },
  label: { color: colors.textPrimary, marginBottom: 4 },
  hint: { color: colors.textTertiary, marginBottom: space.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: space.md,
    backgroundColor: colors.surfaceElevated,
  },
  roleLabel: { color: colors.textSecondary, marginBottom: space.sm },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  roleChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  roleChipText: { color: colors.textSecondary },
  roleChipTextOn: { color: colors.accent, fontWeight: "700" },
  cta: { marginTop: space.sm },
});
