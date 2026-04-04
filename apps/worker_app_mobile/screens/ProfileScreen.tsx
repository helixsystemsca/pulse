import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActionButton } from "@/components/ActionButton";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";
import { useAppStore } from "@/store/useAppStore";

function initialsFrom(name: string | null | undefined, email: string): string {
  if (name?.trim()) {
    const p = name.trim().split(/\s+/);
    const a = p[0]?.[0] ?? "";
    const b = p.length > 1 ? p[p.length - 1][0] ?? "" : "";
    return (a + b).toUpperCase() || email.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function ProfileScreen() {
  const logout = useAppStore((s) => s.logout);
  const user = useAppStore((s) => s.user);

  const email = user?.email ?? "";
  const displayName = user?.full_name?.trim() || email || "Worker";
  const role = user?.role ?? "—";
  const company = user?.company?.name;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Account</Text>

        <View style={styles.avatar}>
          <Text style={styles.initials}>{initialsFrom(user?.full_name, email)}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.role}>{role}</Text>
        <Text style={styles.email}>{email}</Text>
        {company ? <Text style={styles.company}>{company}</Text> : null}

        <View style={[styles.card, shadows.card]}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Pulse features</Text>
            <Text style={styles.rowHint}>{(user?.enabled_features ?? []).join(", ") || "Default"}</Text>
          </View>
        </View>

        <View style={styles.signOut}>
          <ActionButton label="Sign out" variant="danger" onPress={() => void logout()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: {
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: space.xxl,
    alignItems: "center",
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...typography.screenTitle,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: space.lg,
    marginTop: space.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentSoft,
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  initials: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.accent,
  },
  name: {
    ...typography.greeting,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: "center",
  },
  role: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: space.xs,
    textAlign: "center",
  },
  email: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: space.xs,
    textAlign: "center",
  },
  company: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: space.xs,
    textAlign: "center",
    marginBottom: space.xl,
  },
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  row: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space.xs,
    minHeight: layout.minTap,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    justifyContent: "center",
  },
  rowLabel: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textTertiary },
  signOut: { alignSelf: "stretch", marginTop: space.xl },
});
