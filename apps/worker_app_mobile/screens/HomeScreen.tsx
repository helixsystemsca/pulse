import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ActionButton } from "@/components/ActionButton";
import { Header } from "@/components/Header";
import { StatusCard } from "@/components/StatusCard";
import { colors, layout, space, typography } from "@/utils/designTokens";
import { mockHome } from "@/utils/mockData";

export function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
            tintColor={colors.accent}
          />
        }
      >
        <Header
          eyebrow={mockHome.shiftLabel}
          title={`Hi, ${mockHome.greetingName}`}
          rightAccessory={
            <TouchableOpacity
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => undefined}
              style={styles.iconTap}
            >
              <MaterialCommunityIcons name="bell-outline" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          }
        />

        <Text style={styles.section}>Overview</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScroll}
        >
          {mockHome.statusCards.map((c) => (
            <StatusCard
              key={c.id}
              label={c.label}
              value={c.value}
              hint={c.hint}
              variant={c.variant}
              onPress={() => undefined}
            />
          ))}
        </ScrollView>

        <View style={styles.actionsBlock}>
          <Text style={styles.section}>Quick actions</Text>
          {mockHome.primaryActions.map((a) => (
            <View key={a.id} style={styles.actionGap}>
              <ActionButton label={a.label} onPress={() => undefined} variant={a.variant} />
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Pull to refresh · mock data</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  iconTap: { minWidth: layout.minTap, alignItems: "flex-end", justifyContent: "center" },
  section: {
    ...typography.section,
    color: colors.textSecondary,
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: space.sm,
    marginTop: space.sm,
  },
  hScroll: {
    paddingLeft: layout.screenPaddingH,
    paddingRight: layout.screenPaddingH - space.sm,
    gap: space.sm,
    paddingBottom: space.md,
    flexDirection: "row",
  },
  actionsBlock: {
    paddingHorizontal: layout.screenPaddingH,
    marginTop: space.md,
  },
  actionGap: { marginBottom: space.md },
  footer: { padding: layout.screenPaddingH, paddingBottom: space.xxl },
  footerText: { ...typography.caption, color: colors.textTertiary, textAlign: "center" },
});
