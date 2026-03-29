import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Header } from "@/components/Header";
import { ToolList } from "@/components/ToolList";
import { colors, layout, radius, space, typography } from "@/utils/designTokens";
import { mockToolboxSearchPlaceholder, mockTools } from "@/utils/mockData";

export function ToolsScreen() {
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
        <Header eyebrow="Floor" title="Toolbox" />

        <View style={styles.searchWrap}>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            onPress={() => undefined}
            style={styles.search}
          >
            <MaterialCommunityIcons name="magnify" size={22} color={colors.textTertiary} />
            <Text style={styles.searchPlaceholder}>{mockToolboxSearchPlaceholder}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.count}>{mockTools.length} items</Text>

        <ToolList items={mockTools} onItemPress={() => undefined} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  searchWrap: {
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: space.md,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.minTap,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  searchPlaceholder: {
    ...typography.body,
    color: colors.textTertiary,
  },
  count: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: layout.screenPaddingH + space.sm,
    marginBottom: space.sm,
  },
});
