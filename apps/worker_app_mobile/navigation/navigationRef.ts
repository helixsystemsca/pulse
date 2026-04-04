import { createNavigationContainerRef } from "@react-navigation/native";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToIssueDetail(issueId: string) {
  if (!navigationRef.isReady()) return;
  // @ts-expect-error nested navigate
  navigationRef.navigate("Main", {
    screen: "Issues",
    params: { screen: "IssueDetail", params: { issueId } },
  });
}
