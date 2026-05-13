import { apiFetch } from "@/lib/api";

export type FeedbackFeatureOption = { id: string; label: string };

export type FeedbackRow = {
  id: string;
  company_id: string;
  author_user_id: string;
  author_email: string | null;
  author_name: string | null;
  feature_key: string;
  feature_label: string;
  body: string;
  created_at: string;
  admin_read_at: string | null;
  xp_awarded_at: string | null;
  xp_amount: number;
  rewarded_by_user_id: string | null;
};

export function fetchFeedbackFeatures(): Promise<FeedbackFeatureOption[]> {
  return apiFetch<FeedbackFeatureOption[]>("/api/v1/feedback/features");
}

export function fetchFeedbackUnreadCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/api/v1/feedback/unread-count");
}

export function submitFeedback(body: { feature_key: string; body: string }): Promise<FeedbackRow> {
  return apiFetch<FeedbackRow>("/api/v1/feedback", { method: "POST", json: body });
}

export function fetchCompanyFeedback(): Promise<FeedbackRow[]> {
  return apiFetch<FeedbackRow[]>("/api/v1/feedback");
}

export function markAllFeedbackRead(): Promise<void> {
  return apiFetch<undefined>("/api/v1/feedback/mark-all-read", { method: "POST" });
}

export function markFeedbackRead(feedbackId: string): Promise<FeedbackRow> {
  return apiFetch<FeedbackRow>(`/api/v1/feedback/${encodeURIComponent(feedbackId)}/read`, { method: "POST" });
}

export function deleteFeedback(feedbackId: string): Promise<void> {
  return apiFetch<undefined>(`/api/v1/feedback/${encodeURIComponent(feedbackId)}`, { method: "DELETE" });
}

export function awardFeedbackXp(feedbackId: string, xp_amount = 25): Promise<FeedbackRow> {
  return apiFetch<FeedbackRow>(`/api/v1/feedback/${encodeURIComponent(feedbackId)}/award-xp`, {
    method: "POST",
    json: { xp_amount },
  });
}
