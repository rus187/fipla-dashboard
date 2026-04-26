import type { AdvisoryContext } from "./recommendationEngine";

export type ClaudeAdvisoryBlocks = {
  recommendationLogic: string;
  actionPriorities: string;
  vigilancePoints: string;
  conclusion: string;
};

export type ClaudeAdvisoryResult =
  | { status: "ok"; blocks: ClaudeAdvisoryBlocks }
  | { status: "error"; message: string };

export async function generateClaudeAdvisory(
  context: AdvisoryContext
): Promise<ClaudeAdvisoryResult> {
  try {
    const res = await fetch("/api/advisor/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { status: "error", message: (body as { error?: string }).error ?? `Erreur ${res.status}` };
    }

    return { status: "ok", blocks: (body as { blocks: ClaudeAdvisoryBlocks }).blocks };
  } catch {
    return { status: "error", message: "Impossible de contacter le serveur" };
  }
}
