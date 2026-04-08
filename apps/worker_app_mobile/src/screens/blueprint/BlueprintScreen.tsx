import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { MOCK_MARKERS } from "@/data/mockBlueprint";
import { ScreenContainer } from "@/components/ScreenContainer";
import { colors, radius, space, typography } from "@/utils/designTokens";
import type { BlueprintStackParamList } from "@/types/navigation";

const { width: W } = Dimensions.get("window");
const PLAN_H = Math.round(W * 0.72);

type Nav = NativeStackNavigationProp<BlueprintStackParamList, "BlueprintMain">;

export function BlueprintScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation<Nav>();

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <Text style={[typography.title, styles.title]}>Blueprint</Text>
      <Text style={[typography.bodySm, styles.sub]}>L3 mechanical — mock floor plan & assets.</Text>

      <View style={[styles.plan, { height: PLAN_H }]}>
        <View style={styles.grid}>
          <View style={[styles.room, styles.r1]} />
          <View style={[styles.room, styles.r2]} />
          <View style={[styles.room, styles.r3]} />
        </View>
        {MOCK_MARKERS.map((m) => (
          <Pressable
            key={m.id}
            style={[
              styles.marker,
              {
                top: `${m.topPct}%`,
                left: `${m.leftPct}%`,
              },
            ]}
            onPress={() => nav.navigate("MarkerDetail", { markerId: m.id })}
          >
            <Text style={styles.markerText}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[typography.caption, styles.legend]}>Tap a marker for equipment & tasks.</Text>
      <View style={{ height: tabBar }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary },
  sub: { color: colors.textSecondary, marginTop: space.sm, marginBottom: space.md },
  plan: {
    width: "100%",
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  grid: { ...StyleSheet.absoluteFillObject, flexDirection: "row", flexWrap: "wrap" },
  room: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  r1: { width: "55%", height: "42%" },
  r2: { width: "45%", height: "42%" },
  r3: { width: "100%", height: "58%" },
  marker: {
    position: "absolute",
    marginTop: -18,
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  markerText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  legend: { color: colors.textTertiary, marginTop: space.md },
});
