import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { MOCK_ASSIGNMENTS } from "@/data/mockAssignments";
import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatusBadge } from "@/components/StatusBadge";
import { colors, radius, space, typography } from "@/utils/designTokens";
import type { AssignmentsStackParamList } from "@/types/navigation";
import type { TaskStatus } from "@/types/models";

type Nav = NativeStackNavigationProp<AssignmentsStackParamList, "TaskDetail">;

export function TaskDetailScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation<Nav>();
  const route = useRoute();
  const { taskId } = route.params as { taskId: string };

  const base = useMemo(() => MOCK_ASSIGNMENTS.find((t) => t.id === taskId), [taskId]);
  const [status, setStatus] = useState<TaskStatus>(base?.status ?? "pending");
  const [notes, setNotes] = useState("");

  if (!base) {
    return (
      <ScreenContainer scroll bottomInset={tabBar}>
        <Text style={typography.body}>Task not found.</Text>
        <SecondaryButton label="Back" onPress={() => nav.goBack()} style={{ marginTop: space.lg }} />
      </ScreenContainer>
    );
  }

  const onStart = () => setStatus("in_progress");
  const onPause = () => setStatus("paused");
  const onComplete = () => {
    setStatus("completed");
    Alert.alert("Completed", "Status updated locally (wire PATCH when API is ready).");
  };

  return (
    <ScreenContainer scroll bottomInset={tabBar}>
      <SecondaryButton label="← Back" onPress={() => nav.goBack()} style={styles.back} />
      <View style={styles.headRow}>
        <PriorityBadge priority={base.priority} />
        <StatusBadge status={status} />
      </View>
      <Text style={[typography.title, styles.title]}>{base.title}</Text>
      <Text style={[typography.bodySm, styles.loc]}>{base.locationLabel}</Text>

      <Card style={styles.block}>
        <Text style={[typography.subtitle, styles.blockTitle]}>Description</Text>
        <Text style={[typography.bodySm, styles.body]}>{base.description}</Text>
      </Card>

      <Text style={[typography.subtitle, styles.blockTitle]}>Time on task</Text>
      <View style={styles.actions}>
        <PrimaryButton label="Start" onPress={onStart} disabled={status === "in_progress"} />
        <SecondaryButton label="Pause" onPress={onPause} disabled={status !== "in_progress"} />
        <PrimaryButton
          label="Complete"
          variant="primary"
          onPress={onComplete}
          disabled={status === "completed"}
        />
      </View>

      <Text style={[typography.subtitle, styles.blockTitle]}>Notes</Text>
      <TextInput
        style={styles.notes}
        placeholder="Add shift notes…"
        placeholderTextColor={colors.textTertiary}
        multiline
        value={notes}
        onChangeText={setNotes}
      />

      <SecondaryButton
        label="Upload photo (UI only)"
        onPress={() => Alert.alert("Photos", "Wire expo-image-picker + presigned upload to FastAPI.")}
      />

      <PrimaryButton
        label="Flag issue"
        variant="danger"
        onPress={() => nav.navigate("FlagIssue", { taskId: base.id })}
        style={{ marginTop: space.md }}
      />

      <View style={{ height: tabBar + space.lg }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", marginBottom: space.md },
  headRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: space.md },
  title: { color: colors.textPrimary },
  loc: { color: colors.textSecondary, marginBottom: space.lg },
  block: { marginBottom: space.lg },
  blockTitle: { color: colors.textPrimary, marginBottom: space.sm },
  body: { color: colors.textSecondary, lineHeight: 22 },
  actions: { gap: space.sm, marginBottom: space.lg },
  notes: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: "top",
    color: colors.textPrimary,
    marginBottom: space.md,
    backgroundColor: colors.surface,
  },
});
