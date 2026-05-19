import type { BriefValidated, CuratedIdea, ScoredIdea } from "../shared/types";
import { GrokClient, parseJsonArray } from "./grokClient";

const SYSTEM = `You are an idea curator. You will be given a brief and a list of candidate ideas with scores.

Your job: select the true gems — ideas that are BOTH high-relevance AND genuinely non-trivial. Reject high-scoring-but-obvious ideas. Prefer ideas with surprising mechanistic transfers.

Output a JSON array of objects: { "id": "<idea id>", "curated_reason": "<one sentence why>" }. Aim for 10–20 selections. No prose outside the array.`;

export interface CurateOptions {
  client: GrokClient;
  brief: BriefValidated;
  scored: ScoredIdea[];
  topPercent?: number;
  temperature?: number;
  target?: { min: number; max: number };
}

/**
 * Take the top-N by composite, then ask the model to pick the genuine gems.
 */
export async function curateIdeas(opts: CurateOptions): Promise<CuratedIdea[]> {
  const { client, brief, scored, topPercent = 0.15, temperature = 0.4, target = { min: 10, max: 20 } } = opts;
  const sorted = [...scored].sort((a, b) => b.composite - a.composite);
  const topN = Math.max(target.max, Math.ceil(sorted.length * topPercent));
  const shortlist = sorted.slice(0, topN);

  const user = [
    `Brief: ${brief.problem}`,
    `Good ideas: ${brief.good_idea_criteria}`,
    `Select ${target.min}–${target.max} gems from this shortlist:`,
    ...shortlist.map((i) => `[${i.id}] (composite=${i.composite.toFixed(2)}) ${i.idea}`),
  ].join("\n");

  const text = await client.chat({ system: SYSTEM, user, temperature });
  const picked = parseJsonArray<{ id: string; curated_reason: string }>(text);
  const reasonById = new Map(picked.map((p) => [p.id, p.curated_reason]));
  return shortlist
    .filter((i) => reasonById.has(i.id))
    .map((i) => ({ ...i, curated_reason: reasonById.get(i.id) }));
}
