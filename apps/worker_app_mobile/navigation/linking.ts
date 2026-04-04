import * as Linking from "expo-linking";

const prefix = Linking.createURL("/");

export const linking = {
  prefixes: [prefix, "helix-worker://"],
  config: {
    screens: {
      Login: "login",
      Main: {
        screens: {
          Dashboard: "dashboard",
          Issues: {
            path: "issues",
            screens: {
              IssuesList: "",
              IssueDetail: "issue/:issueId",
              ReportIssue: "report",
            },
          },
          Toolbox: {
            path: "toolbox",
            screens: {
              ToolboxHome: "",
              DeviceLookup: "device-lookup",
              SensorStatus: "sensors",
              SopList: "sop",
              QuickMetrics: "metrics",
              Profile: "profile",
            },
          },
          Forms: {
            path: "forms",
            screens: {
              FormsList: "",
              FormFill: "form/:formId",
            },
          },
          Alerts: "alerts",
        },
      },
    },
  },
};
