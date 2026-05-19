import type { BriefValidated, Domain } from "../shared/types";
import { GrokClient, parseJsonArray } from "./grokClient";

const SYSTEM = `You are a semantic distance engine. Your task is to generate knowledge domains that are structurally as far as possible from the user's problem domain.

For each domain, provide:
1. Domain name (specific sub-discipline, not vague categories)
2. Active principle: a counter-intuitive mechanism *from that domain*
3. Bridging question: how does this mechanism apply to the user's brief?

AVOID: adjacent fields, obvious metaphors, domains the user mentioned.
PRIORITIZE: hard sciences, obscure engineering subfields, pre-modern crafts, biological systems, economic edge cases, failure modes.

Output a JSON array of objects with keys: name, active_principle, bridging_question. No prose outside the array.`;

export interface DomainGenOptions {
  client: GrokClient;
  brief: BriefValidated;
  forbidden: string[];
  count?: number;
  temperature?: number;
  origin?: Domain["origin"];
}

/**
 * Generate a bank of distant knowledge domains for the brief.
 */
export async function generateDomains(
  opts: DomainGenOptions,
): Promise<Domain[]> {
  const { client, brief, forbidden, count = 10, temperature = 0.95, origin = "fresh" } = opts;
  const user = [
    `Brief: ${brief.problem}`,
    `Good ideas: ${brief.good_idea_criteria}`,
    `Forbidden topics (must avoid): ${forbidden.join(", ") || "(none)"}`,
    `Generate exactly ${count} structurally distant domains.`,
  ].join("\n\n");

  const text = await client.chat({ system: SYSTEM, user, temperature });
  const parsed = parseJsonArray<{
    name: string;
    active_principle: string;
    bridging_question: string;
  }>(text);
  return parsed.map((d, i) => ({
    id: `D${String(i + 1).padStart(2, "0")}`,
    name: d.name,
    active_principle: d.active_principle,
    bridging_question: d.bridging_question,
    origin,
  }));
}
