import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

export type AssignmentsStackParamList = {
  AssignmentsList: undefined;
  TaskDetail: { taskId: string };
  FlagIssue: { taskId: string };
};

export type ToolboxStackParamList = {
  ToolboxList: undefined;
};

export type ScheduleStackParamList = {
  ScheduleMain: undefined;
  VacationRequest: undefined;
  AvailabilityEditor: undefined;
};

export type BlueprintStackParamList = {
  BlueprintMain: undefined;
  MarkerDetail: { markerId: string };
};

export type MoreStackParamList = {
  MoreMain: undefined;
  ProjectDetail: { projectId: string };
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type AssignmentsNav = NativeStackNavigationProp<AssignmentsStackParamList>;
