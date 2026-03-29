import { useEffect, useRef } from "react";
import { Vibration } from "react-native";
import { presentLocalMissingToolAlert, requestLocalNotificationPermissions } from "@/services/push";
import { useAppStore } from "@/store/useAppStore";
import { getWsBaseUrl } from "@/utils/config";
import { isWorkerAlertEventType, streamEventTitleBody } from "@/utils/stream";

const LOCAL_NOTIFY_MIN_MS = 2500;

/** Tenant realtime WS — mirrors web WorkerStreamProvider. */
export function StreamBridge() {
  const token = useAppStore((s) => s.token);
  const pushFeed = useAppStore((s) => s.pushFeedFromStream);
  const setStatus = useAppStore((s) => s.setStreamStatus);
  const askedPerms = useRef(false);
  const lastLocalNotifyAt = useRef(0);

  useEffect(() => {
    if (!askedPerms.current) {
      askedPerms.current = true;
      void requestLocalNotificationPermissions();
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("idle");
      return;
    }

    const wsUrl = `${getWsBaseUrl()}/api/v1/ws?token=${encodeURIComponent(token)}`;
    setStatus("connecting");
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setStatus("live");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("idle");

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as Parameters<typeof pushFeed>[0];
        pushFeed(data);
        if (isWorkerAlertEventType(data.event_type)) {
          try {
            Vibration.vibrate(80);
          } catch {
            /* no vibrator */
          }
          const now = Date.now();
          if (now - lastLocalNotifyAt.current >= LOCAL_NOTIFY_MIN_MS) {
            lastLocalNotifyAt.current = now;
            void (async () => {
              const { title, body } = streamEventTitleBody(data);
              await presentLocalMissingToolAlert(title, body);
            })();
          }
        }
      } catch {
        /* ignore */
      }
    };

    const ping = setInterval(() => {
      try {
        ws.send("ping");
      } catch {
        /* closed */
      }
    }, 25_000);

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [token, pushFeed, setStatus]);

  return null;
}
