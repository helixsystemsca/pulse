import { ActiveAlertRow } from "@/components/dashboard/widgets/alerts/views/row";
import type { AlertsWidgetAlert } from "@/components/dashboard/widgets/alerts/AlertsWidget";

export function AlertsXl({ alerts, realAlerts }: { alerts: AlertsWidgetAlert[]; realAlerts: AlertsWidgetAlert[] }) {
  const show = realAlerts.length ? realAlerts : alerts;
  return (
    <div className="min-h-0 flex-1 overflow-auto pr-0.5">
      <ul className="flex min-h-0 flex-1 flex-col gap-2">
        {show.map((a, idx) => (
          <ActiveAlertRow key={`${a.title}-${idx}`} alert={a} />
        ))}
      </ul>
    </div>
  );
}

