import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/ListSkeleton";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScreenContainer } from "@/components/ScreenContainer";
import { StatusBadge } from "@/components/StatusBadge";
import { useTodayAssignments } from "@/hooks/useTodayAssignments";
import { useSessionStore } from "@/store/useSessionStore";
import { colors, space, typography } from "@/utils/designTokens";
import type { AssignmentsStackParamList } from "@/types/navigation";
import type { FieldTask } from "@/types/models";

type Nav = NativeStackNavigationProp<AssignmentsStackParamList, "AssignmentsList">;

export function AssignmentsScreen() {
  const tabBar = useBottomTabBarHeight();
  const nav = useNavigation<Nav>();
  const user = useSessionStore((s) => s.user);
  const { data, isLoading, isError, refetch, isFetching } = useTodayAssignments();

  const renderItem = ({ item }: { item: FieldTask }) => (
    <Pressable onPress={() => nav.navigate("TaskDetail", { taskId: item.id })}>
      <Card style={styles.card}>
        <View style={styles.rowTop}>
          <PriorityBadge priority={item.priority} />
          <StatusBadge status={item.status} />
        </View>
        <Text style={[typography.subtitle, styles.title]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[typography.bodySm, styles.loc]} numberOfLines={1}>
          {item.locationLabel}
        </Text>
        {item.dueTime ? (
          <Text style={[typography.caption, styles.due]}>Due · {item.dueTime}</Text>
        ) : null}
      </Card>
    </Pressable>
  );

  return (
    <ScreenContainer bottomInset={tabBar}>
      <View style={styles.header}>
        <Text style={[typography.caption, styles.kicker]}>Today</Text>
        <Text style={[typography.title, styles.screenTitle]}>Assignments</Text>
        <Text style={[typography.bodySm, styles.greet]}>
          {user?.displayName ?? "Operator"} — tap a task to work it.
        </Text>
      </View>
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : isError ? (
        <EmptyState title="Couldn’t load assignments" subtitle="Pull to retry when online." />
      ) : !data?.length ? (
        <EmptyState title="You’re clear" subtitle="No assignments for today." />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: tabBar + space.xl, flexGrow: 1 }}
          onRefresh={() => refetch()}
          refreshing={isFetching && !isLoading}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  kicker: { color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 1 },
  screenTitle: { color: colors.textPrimary, marginTop: 4 },
  greet: { color: colors.textSecondary, marginTop: space.sm },
  card: { marginHorizontal: 0 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: space.sm },
  title: { color: colors.textPrimary },
  loc: { color: colors.textSecondary, marginTop: 4 },
  due: { color: colors.textTertiary, marginTop: 8 },
});
