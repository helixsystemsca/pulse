import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AssignmentsScreen } from "@/screens/assignments/AssignmentsScreen";
import { FlagIssueScreen } from "@/screens/assignments/FlagIssueScreen";
import { TaskDetailScreen } from "@/screens/assignments/TaskDetailScreen";
import { colors } from "@/utils/designTokens";
import type { AssignmentsStackParamList } from "@/types/navigation";

const Stack = createNativeStackNavigator<AssignmentsStackParamList>();

export function AssignmentsNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="AssignmentsList"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="AssignmentsList" component={AssignmentsScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="FlagIssue" component={FlagIssueScreen} />
    </Stack.Navigator>
  );
}
