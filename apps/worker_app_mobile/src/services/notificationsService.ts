/**
 * Notification layer — structure for push, in-app alerts, and proximity (future).
 * Wire `expo-notifications` / FCM / APNs here without coupling screens.
 */

type NotificationHandler = (payload: Record<string, unknown>) => void;

class NotificationsService {
  private handlers: NotificationHandler[] = [];

  /** Call once on app start. Register device token with backend when ready. */
  async initialize(): Promise<void> {
    // TODO: request permissions, get Expo push token, POST to FastAPI
    // await Notifications.requestPermissionsAsync();
    // const token = await Notifications.getExpoPushTokenAsync({ projectId });
  }

  /** Subscribe to foreground / tap events after push is wired. */
  subscribe(handler: NotificationHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** Local test alert — replace with real scheduling. */
  scheduleMockAlert(title: string, body: string, data?: Record<string, unknown>): void {
    const payload = { title, body, ...(data ?? {}) };
    this.handlers.forEach((h) => h(payload));
  }

  /**
   * Proximity / beacon style hook — backend or device SDK will call this.
   * Mock: invoke when geofence simulation fires.
   */
  emitProximityEvent(zoneId: string, label: string): void {
    this.handlers.forEach((h) =>
      h({ type: "proximity", zoneId, label, at: new Date().toISOString() }),
    );
  }
}

export const notificationsService = new NotificationsService();
