import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MOCK_MY_SCHEDULE, MOCK_TEAM_SCHEDULE } from "@/data/mockSchedule";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenContainer } from "@/components/ScreenContainer";
import { usePermissions } from "@/hooks/usePermissions";
import { colors, radius, space, typography } from "@/utils/designTokens";
import type { ScheduleStackParamList } from "@/types/navigation";
import type { ScheduleSlot } from "@/types/models";

type Nav = NativeStackNavigationProp<ScheduleStackParamList, "ScheduleMain">;

export function ScheduleScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation<Nav>();
  const perms = usePermissions();
  const [mode, setMode] = useState<"my" | "team">("my");

  useEffect(() => {
    if (!perms.viewTeamSchedule && mode === "team") setMode("my");
  }, [perms.viewTeamSchedule, mode]);

  const data = mode === "my" || !perms.viewTeamSchedule ? MOCK_MY_SCHEDULE : MOCK_TEAM_SCHEDULE;

  const renderRow = ({ item }: { item: ScheduleSlot }) => (
    <Card style={styles.card}>
      <Text style={[typography.subtitle, styles.slotTitle]}>{item.title}</Text>
      <Text style={[typography.bodySm, styles.meta]}>
        {item.startLabel} – {item.endLabel} · {item.locationLabel}
      </Text>
      {item.workerName ? (
        <Text style={[typography.caption, styles.worker]}>{item.workerName}</Text>
      ) : null}
    </Card>
  );

  return (
    <ScreenContainer bottomInset={tabBar}>
      <Text style={[typography.title, styles.title]}>Schedule</Text>
      <Text style={[typography.bodySm, styles.sub]}>Lightweight view — full scheduling stays on web.</Text>

      <View style={styles.toggle}>
        <Pressable
          onPress={() => setMode("my")}
          style={[styles.seg, mode === "my" && styles.segOn]}
        >
          <Text style={[typography.caption, mode === "my" ? styles.segTextOn : styles.segText]}>My schedule</Text>
        </Pressable>
        {perms.viewTeamSchedule ? (
          <Pressable
            onPress={() => setMode("team")}
            style={[styles.seg, mode === "team" && styles.segOn]}
          >
            <Text style={[typography.caption, mode === "team" ? styles.segTextOn : styles.segText]}>
              Team schedule
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.seg, styles.segDisabled]}>
            <Text style={[typography.caption, styles.segTextMuted]}>Team (locked)</Text>
          </View>
        )}
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        contentContainerStyle={{ paddingBottom: tabBar + space.xl, flexGrow: 1 }}
        ListFooterComponent={
          <View style={styles.footer}>
            <PrimaryButton label="Request vacation" onPress={() => nav.navigate("VacationRequest")} />
            <PrimaryButton
              label="Set availability"
              variant="ghost"
              onPress={() => nav.navigate("AvailabilityEditor")}
              style={{ marginTop: space.sm }}
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.textPrimary, marginTop: space.md },
  sub: { color: colors.textSecondary, marginTop: space.sm, marginBottom: space.md },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: space.lg,
    gap: 4,
  },
  seg: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: radius.sm,
  },
  segOn: { backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4 },
  segDisabled: { opacity: 0.55 },
  segText: { color: colors.textSecondary },
  segTextOn: { color: colors.accent, fontWeight: "700" },
  segTextMuted: { color: colors.textTertiary },
  card: { marginBottom: 0 },
  slotTitle: { color: colors.textPrimary },
  meta: { color: colors.textSecondary, marginTop: 6 },
  worker: { color: colors.textTertiary, marginTop: 6 },
  footer: { marginTop: space.lg },
});
