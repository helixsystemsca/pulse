export type StreamEvent = {
  event_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  correlation_id?: string;
};
