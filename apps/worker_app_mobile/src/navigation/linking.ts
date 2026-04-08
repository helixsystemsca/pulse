import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "@/types/navigation";

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["helix-field://", "exp+helix-field://"],
  config: {
    screens: {
      Login: "login",
      Main: {
        screens: {
          Assignments: {
            screens: {
              AssignmentsList: "assignments",
              TaskDetail: "assignments/:taskId",
              FlagIssue: "assignments/:taskId/flag",
            },
          },
          Toolbox: "tools",
          Schedule: "schedule",
          Blueprint: "blueprint",
          More: "more",
        },
      },
    },
  },
};
