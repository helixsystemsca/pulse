import { ActiveAlertRow } from "@/components/dashboard/widgets/alerts/views/row";
import type { AlertsWidgetAlert } from "@/components/dashboard/widgets/alerts/AlertsWidget";

export function AlertsXs({ alerts }: { alerts: AlertsWidgetAlert[]; realAlerts: AlertsWidgetAlert[] }) {
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2">
      {alerts.slice(0, 1).map((a, idx) => (
        <ActiveAlertRow key={`${a.title}-${idx}`} alert={a} compact />
      ))}
    </ul>
  );
}

