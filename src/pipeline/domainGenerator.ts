import type { BriefValidated, CuratedIdea, Domain } from "../shared/types";
import { GrokClient, parseJsonArray } from "./grokClient";

const FRESH_SYSTEM = `You are a semantic distance engine. Generate knowledge domains that are structurally as far as possible from the user's problem domain.

For each domain provide:
1. Domain name (specific sub-discipline — not vague categories)
2. Active principle: a counter-intuitive mechanism *from that domain*
3. Bridging question: how does this mechanism apply to the user's brief?

AVOID: adjacent fields, obvious metaphors, domains the user mentioned.
PRIORITIZE: hard sciences, obscure engineering subfields, pre-modern crafts, biological systems, economic edge cases, failure modes.

Output a JSON array of objects with keys: name, active_principle, bridging_question. No prose outside the array.`;

const DEEPEN_SYSTEM = `You are expanding a knowledge domain into specific sub-disciplines for deeper creative exploration.

Given a parent domain with its active principle, generate tightly-scoped sub-specialties. Each sub-specialty must:
- Be more specific than the parent (a real named sub-field, not a rephrasing)
- Introduce a NEW counter-intuitive mechanism not present in the parent
- Connect to the user's brief in a different way than the parent did

Output a JSON array of objects with keys: name, active_principle, bridging_question. No prose outside the array.`;

const REFRESH_SYSTEM = `You are a structural analogy engine. Given a set of high-quality ideas from a brainstorm, identify the underlying causal mechanisms that made them interesting, then find entirely different knowledge domains that share those structural patterns.

Output a JSON array of objects with keys: name, active_principle, bridging_question. No prose outside the array.`;

export interface DomainGenOptions {
  client: GrokClient;
  brief: BriefValidated;
  forbidden: string[];
  count?: number;
  temperature?: number;
  origin?: Domain["origin"];
}

/** Generate fresh, structurally distant domains. */
export async function generateDomains(opts: DomainGenOptions): Promise<Domain[]> {
  const { client, brief, forbidden, count = 10, temperature = 0.95, origin = "fresh" } = opts;
  const user = [
    `Brief: ${brief.problem}`,
    `Good ideas: ${brief.good_idea_criteria}`,
    `Forbidden topics: ${forbidden.join(", ") || "(none)"}`,
    `Generate exactly ${count} structurally distant domains.`,
  ].join("\n\n");

  const text = await client.chat({ system: FRESH_SYSTEM, user, temperature });
  return parseJsonArray<{ name: string; active_principle: string; bridging_question: string }>(text)
    .map((d, i) => ({
      id: `D${String(i + 1).padStart(2, "0")}`,
      name: d.name,
      active_principle: d.active_principle,
      bridging_question: d.bridging_question,
      origin,
    }));
}

export interface DeepenOptions {
  client: GrokClient;
  brief: BriefValidated;
  parentDomains: Domain[];
  countPerParent?: number;
  temperature?: number;
}

/** For each loved domain, generate more specific sub-disciplines. */
export async function deepenDomains(opts: DeepenOptions): Promise<Domain[]> {
  const { client, brief, parentDomains, countPerParent = 1, temperature = 0.9 } = opts;
  const results: Domain[] = [];

  for (const parent of parentDomains) {
    const user = [
      `Brief: ${brief.problem}`,
      `Parent domain: ${parent.name}`,
      `Parent active principle: ${parent.active_principle}`,
      `Parent bridging question: ${parent.bridging_question}`,
      `Generate ${countPerParent} deeper sub-specialt${countPerParent === 1 ? "y" : "ies"} of this domain.`,
    ].join("\n\n");

    try {
      const text = await client.chat({ system: DEEPEN_SYSTEM, user, temperature });
      const parsed = parseJsonArray<{ name: string; active_principle: string; bridging_question: string }>(text);
      parsed.forEach((d, i) => {
        results.push({
          id: `D-deep-${parent.id}-${i + 1}`,
          name: d.name,
          active_principle: d.active_principle,
          bridging_question: d.bridging_question,
          origin: "deepen",
          parent_domain_id: parent.id,
        });
      });
    } catch {
      // skip failed deepen — fresh domains will fill the gap
    }
  }
  return results;
}

export interface RefreshOptions {
  client: GrokClient;
  brief: BriefValidated;
  topIdeas: CuratedIdea[];
  count?: number;
  temperature?: number;
}

/** Extract mechanisms from top ideas and find new domains with the same structural patterns. */
export async function refreshDomains(opts: RefreshOptions): Promise<Domain[]> {
  const { client, brief, topIdeas, count = 3, temperature = 0.92 } = opts;
  const ideaSample = topIdeas.slice(0, 8).map((i) => i.idea).join("\n- ");

  const user = [
    `Brief: ${brief.problem}`,
    `These high-quality ideas emerged from the previous iteration:\n- ${ideaSample}`,
    `Identify the underlying structural mechanisms that made these ideas interesting.`,
    `Then generate ${count} entirely different knowledge domains that share those same structural patterns but apply them in completely new ways.`,
  ].join("\n\n");

  try {
    const text = await client.chat({ system: REFRESH_SYSTEM, user, temperature });
    return parseJsonArray<{ name: string; active_principle: string; bridging_question: string }>(text)
      .map((d, i) => ({
        id: `D-refresh-${i + 1}`,
        name: d.name,
        active_principle: d.active_principle,
        bridging_question: d.bridging_question,
        origin: "refresh" as Domain["origin"],
      }));
  } catch {
    return [];
  }
}
