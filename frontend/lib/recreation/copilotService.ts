/** Ops Copilot — curated prompts answered from Pulse records. */
import { apiFetch } from "@/lib/api";

export type OpsCopilotPrompt = {
  id: string;
  label: string;
  prompt: string;
  hint: string;
};

export type OpsCopilotCitation = {
  title: string;
  href: string;
  kind: string;
  detail?: string | null;
};

export type OpsCopilotAnswer = {
  prompt_id: string;
  label: string;
  prompt: string;
  answer: string;
  citations: OpsCopilotCitation[];
  disclaimer: string;
};

export async function listCopilotPrompts(): Promise<OpsCopilotPrompt[]> {
  const res = await apiFetch<{ items: OpsCopilotPrompt[] }>("/api/v1/recreation-ops/command/copilot/prompts");
  return res.items;
}

export async function askCopilot(promptId: string): Promise<OpsCopilotAnswer> {
  return apiFetch<OpsCopilotAnswer>("/api/v1/recreation-ops/command/copilot/ask", {
    method: "POST",
    json: { prompt_id: promptId },
  });
}

export async function askCopilotQuery(query: string): Promise<OpsCopilotAnswer> {
  return apiFetch<OpsCopilotAnswer>("/api/v1/recreation-ops/command/copilot/ask", {
    method: "POST",
    json: { query },
  });
}
