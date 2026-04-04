import { useNavigation } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { colors, layout, radius, shadows, space, typography } from "@/utils/designTokens";

type Tile = {
  id: string;
  label: string;
  sub: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: string;
};

const TILES: Tile[] = [
  { id: "1", label: "Device lookup", sub: "Tags & gateways", icon: "bluetooth-connect", route: "DeviceLookup" },
  { id: "2", label: "Sensor status", sub: "Live health", icon: "gauge", route: "SensorStatus" },
  { id: "3", label: "SOP / procedures", sub: "Step-by-step", icon: "book-open-variant", route: "SopList" },
  { id: "4", label: "Quick metrics", sub: "Counts & SLA", icon: "chart-line", route: "QuickMetrics" },
  { id: "5", label: "Account", sub: "Profile & sign out", icon: "account-cog", route: "Profile" },
];

export function ToolboxScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Text style={typography.screenTitle}>TOOLBOX</Text>
      <Text style={typography.greeting}>Utilities</Text>
      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable
            key={t.id}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.92 }]}
            onPress={() =>
              (navigation as { navigate: (a: string) => void }).navigate(t.route as never)
            }
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={t.icon} size={28} color={colors.accent} />
            </View>
            <Text style={styles.tileTitle}>{t.label}</Text>
            <Text style={styles.tileSub}>{t.sub}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: layout.screenPaddingH },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.lg,
    justifyContent: "space-between",
  },
  tile: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 132,
    ...shadows.card,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  tileTitle: { ...typography.bodySm, fontWeight: "800", color: colors.textPrimary },
  tileSub: { marginTop: 4, ...typography.caption, color: colors.textTertiary },
});
