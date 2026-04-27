import { apiFetch } from "./client";

export type SearchResultItem = {
  id: string;
  kind: "tool" | "equipment" | "procedure" | "work_request";
  title: string;
  subtitle?: string | null;
  meta: Record<string, unknown>;
};

export type SearchResults = {
  query: string;
  tools: SearchResultItem[];
  equipment: SearchResultItem[];
  procedures: SearchResultItem[];
  work_requests: SearchResultItem[];
  total: number;
};

export async function search(token: string, q: string): Promise<SearchResults> {
  return apiFetch<SearchResults>(`/api/v1/search?q=${encodeURIComponent(q)}`, { token });
}
