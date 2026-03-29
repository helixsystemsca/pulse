import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActionButton } from "@/components/ActionButton";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";
import { mockProfile } from "@/utils/mockData";
import { useAppStore } from "@/store/useAppStore";

export function ProfileScreen() {
  const logout = useAppStore((s) => s.logout);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Account</Text>

        <View style={styles.avatar}>
          <Text style={styles.initials}>{mockProfile.initials}</Text>
        </View>
        <Text style={styles.name}>{mockProfile.name}</Text>
        <Text style={styles.role}>{mockProfile.role}</Text>
        <Text style={styles.email}>{mockProfile.email}</Text>

        <View style={[styles.card, shadows.card]}>
          {mockProfile.menuRows.map((row, i) => (
            <TouchableOpacity
              key={row.id}
              accessibilityRole="button"
              activeOpacity={0.88}
              onPress={() => undefined}
              style={[styles.row, i > 0 && styles.rowBorder]}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <View style={styles.rowRight}>
                {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: layout.minTap,
    paddingHorizontal: space.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  rowLabel: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  rowRight: { flexDirection: "row", alignItems: "center", gap: space.xs },
  rowHint: { ...typography.caption, color: colors.textTertiary },
  signOut: { alignSelf: "stretch", marginTop: space.xl },
});
