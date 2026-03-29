import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCard } from "@/components/AlertCard";
import { Header } from "@/components/Header";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";
import { mockAlertFilters, mockAlerts } from "@/utils/mockData";

export function AlertsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<(typeof mockAlertFilters)[number]>("All");

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
        <Header eyebrow="Live updates" title="Alerts" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {mockAlertFilters.map((f) => {
            const selected = f === filter;
            return (
              <TouchableOpacity
                key={f}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setFilter(f)}
                style={[styles.chip, selected && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.list}>
          {mockAlerts.map((a) => (
            <AlertCard key={a.id} {...a} onPress={() => undefined} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  chips: {
    paddingHorizontal: layout.screenPaddingH,
    gap: space.sm,
    paddingBottom: space.md,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
    justifyContent: "center",
  },
  chipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  chipLabelOn: { color: "#FFFFFF" },
  list: { paddingBottom: space.xxl },
});
