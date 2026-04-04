import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "@/utils/designTokens";
import { AlertsInboxScreen } from "@/screens/AlertsInboxScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { FormFillScreen } from "@/screens/FormFillScreen";
import { FormsScreen } from "@/screens/FormsScreen";
import { IssueDetailScreen } from "@/screens/IssueDetailScreen";
import { IssuesScreen } from "@/screens/IssuesScreen";
import { PlaceholderToolScreen } from "@/screens/PlaceholderToolScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { ReportIssueScreen } from "@/screens/ReportIssueScreen";
import { ToolboxScreen } from "@/screens/ToolboxScreen";

const Dash = createNativeStackNavigator();
export function DashboardStack() {
  return (
    <Dash.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Dash.Screen name="DashboardHome" component={DashboardScreen} />
    </Dash.Navigator>
  );
}

export type IssuesStackParamList = {
  IssuesList: undefined;
  IssueDetail: { issueId: string };
  ReportIssue: undefined;
};

const Iss = createNativeStackNavigator<IssuesStackParamList>();
export function IssuesStack() {
  return (
    <Iss.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Iss.Screen name="IssuesList" component={IssuesScreen} />
      <Iss.Screen name="IssueDetail" component={IssueDetailScreen} />
      <Iss.Screen
        name="ReportIssue"
        component={ReportIssueScreen}
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
    </Iss.Navigator>
  );
}

const Tool = createNativeStackNavigator();
export function ToolboxStack() {
  return (
    <Tool.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Tool.Screen name="ToolboxHome" component={ToolboxScreen} />
      <Tool.Screen name="DeviceLookup">
        {() => (
          <PlaceholderToolScreen
            title="Device lookup"
            body="Search BLE tags and gateways registered to your site. Wire this screen to /api/v1/devices when ready."
          />
        )}
      </Tool.Screen>
      <Tool.Screen name="SensorStatus">
        {() => (
          <PlaceholderToolScreen
            title="Sensor status"
            body="Live IoT readings will appear here from the monitoring API."
          />
        )}
      </Tool.Screen>
      <Tool.Screen name="SopList">
        {() => (
          <PlaceholderToolScreen
            title="SOPs & procedures"
            body="Link to your SOP library or in-app HTML procedures."
          />
        )}
      </Tool.Screen>
      <Tool.Screen name="QuickMetrics">
        {() => (
          <PlaceholderToolScreen
            title="Quick metrics"
            body="Snapshot KPIs: open issues, overdue count, and site health."
          />
        )}
      </Tool.Screen>
      <Tool.Screen name="Profile" component={ProfileScreen} />
    </Tool.Navigator>
  );
}

export type FormsStackParamList = {
  FormsList: undefined;
  FormFill: { formId: string };
};

const Frm = createNativeStackNavigator<FormsStackParamList>();
export function FormsStack() {
  return (
    <Frm.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Frm.Screen name="FormsList" component={FormsScreen} />
      <Frm.Screen name="FormFill" component={FormFillScreen} />
    </Frm.Navigator>
  );
}

const Alt = createNativeStackNavigator();
export function AlertsStack() {
  return (
    <Alt.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Alt.Screen name="AlertsHome" component={AlertsInboxScreen} />
    </Alt.Navigator>
  );
}
