import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function navigateToIssueDetail(issueId: string) {
  if (!navigationRef.isReady()) return;
  const nav = navigationRef as {
    navigate: (name: string, params?: Record<string, unknown>) => void;
  };
  nav.navigate("Main", {
    screen: "Issues",
    params: {
      screen: "IssueDetail",
      params: { issueId },
    },
  });
}
