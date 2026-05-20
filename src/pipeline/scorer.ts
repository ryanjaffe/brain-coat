import type { BriefValidated, RawIdea, ScoredIdea, ScoringAxis } from "../shared/types";
import { GrokClient, parseJsonArray } from "./grokClient";
import { pMapLimit } from "./concurrency";

const SYSTEM = `You are an idea evaluator. Given a problem brief and scoring axes, score each idea from 0.0 to 1.0 on each axis.

Output a JSON array, one object per input idea, with shape:
{ "id": "<idea id>", "scores": { "<axis name>": <number 0..1>, ... } }

Be calibrated: 0.5 is average, 0.9+ is exceptional. No prose outside the array.`;

export interface ScoreOptions {
  client: GrokClient;
  brief: BriefValidated;
  ideas: RawIdea[];
  batchSize?: number;
  concurrency?: number;
  temperature?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export async function scoreIdeas(opts: ScoreOptions): Promise<ScoredIdea[]> {
  const { client, brief, ideas, batchSize = 20, concurrency = 3, temperature = 0.2, signal, onProgress } = opts;
  const valid = ideas.filter((i) => i.status === "done" && i.idea.trim());

  const batches: RawIdea[][] = [];
  for (let i = 0; i < valid.length; i += batchSize) batches.push(valid.slice(i, i + batchSize));

  const scored: ScoredIdea[] = [];
  let doneBatches = 0;

  await pMapLimit(
    batches,
    concurrency,
    async (batch) => {
      const user = [
        `Brief: ${brief.problem}`,
        `Good ideas: ${brief.good_idea_criteria}`,
        `Axes (weights in parens):`,
        ...brief.scoring_axes.map((a) => `- ${a.name} (${a.weight}): ${a.description ?? ""}`),
        `Ideas to score:`,
        ...batch.map((i) => `[${i.id}] ${i.idea}`),
      ].join("\n");

      try {
        const text = await client.chat({ system: SYSTEM, user, temperature, signal });
        const parsed = parseJsonArray<{ id: string; scores: Record<string, number> }>(text);
        const byId = new Map(parsed.map((p) => [p.id, p.scores]));
        for (const idea of batch) {
          const scores = byId.get(idea.id) ?? {};
          scored.push({ ...idea, scores, composite: composite(scores, brief.scoring_axes) });
        }
      } catch {
        for (const idea of batch) scored.push({ ...idea, scores: {}, composite: 0 });
      }
      doneBatches += 1;
      onProgress?.(Math.min(doneBatches * batchSize, valid.length), valid.length);
    },
    undefined,
    signal,
  );

  return scored;
}

function composite(scores: Record<string, number>, axes: ScoringAxis[]): number {
  const totalW = axes.reduce((s, a) => s + a.weight, 0) || 1;
  return axes.reduce((acc, a) => acc + (scores[a.name] ?? 0) * a.weight, 0) / totalW;
}
