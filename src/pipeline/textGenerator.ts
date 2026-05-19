import type { BriefValidated, ReferenceText } from "../shared/types";
import { GrokClient, parseJsonArray } from "./grokClient";

const SYSTEM = `You are a research assistant preparing reference material for a semantic brainstorming session.

Given a problem brief, generate a set of substantive reference texts. Each text should:
- Cover a distinct angle, domain, or sub-problem relevant to the brief
- Be dense with specific facts, mechanisms, case studies, or frameworks — NOT generic summaries
- Be 400–600 words of prose (no bullet lists, no headers)
- Contain information that would surprise a non-expert

The goal is to give the idea engine rich, varied material to collide with distant knowledge domains.

Output a JSON array of objects with keys:
  "label": short title (5–8 words),
  "description": one sentence on what angle this covers,
  "content": the full reference text (400–600 words of dense prose)

No text outside the JSON array.`;

export interface TextGenOptions {
  client: GrokClient;
  brief: BriefValidated;
  count?: number;
  temperature?: number;
  onProgress?: (message: string) => void;
}

/**
 * Generate N substantive reference texts for the given brief.
 * Each covers a distinct angle and is ready to use as a collision input.
 */
export async function generateReferenceTexts(
  opts: TextGenOptions,
): Promise<Omit<ReferenceText, "id">[]> {
  const { client, brief, count = 5, temperature = 0.85, onProgress } = opts;

  onProgress?.(`Generating ${count} reference texts with ${client.model}…`);

  const user = [
    `Problem brief: ${brief.problem}`,
    `What counts as a good idea: ${brief.good_idea_criteria}`,
    `Generate exactly ${count} reference texts, each covering a meaningfully different angle.`,
    `Prioritise: empirical case studies, technical mechanisms, historical precedents, economic edge cases, sociological frameworks.`,
    `Avoid: generic overviews, obvious angles, anything directly mentioned in the brief.`,
  ].join("\n\n");

  const raw = await client.chat({ system: SYSTEM, user, temperature, maxTokens: 8192 });
  const parsed = parseJsonArray<{ label: string; description: string; content: string }>(raw);
  return parsed.map((t) => ({
    label: t.label ?? "Reference text",
    description: t.description ?? "",
    content: t.content ?? "",
  }));
}
