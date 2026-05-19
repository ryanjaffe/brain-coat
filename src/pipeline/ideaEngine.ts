import type { BriefValidated, Domain, RawIdea, ReferenceText } from "../shared/types";
import { GrokClient, parseJsonArray } from "./grokClient";
import { pMapLimit } from "./concurrency";

const DEFAULT_PROMPT = `You are a semantic collision engine. You will be given:
- A problem brief
- A reference text (context about the domain)
- A distant-domain active principle

Your task: generate exactly {N} ideas that could ONLY exist through the collision of the reference context with the active principle.

Rules:
- Each idea must be mechanistically grounded in the distant domain
- Each idea must be directly applicable to the brief
- No obvious metaphors — real structural transfers only
- Ideas should be 2–4 sentences: mechanism + application

Output a JSON array of strings (each string is one idea). No prose outside the array.`;

export interface IdeaGenOptions {
  client: GrokClient;
  brief: BriefValidated;
  domains: Domain[];
  texts: ReferenceText[];
  perCollision?: number;
  concurrency?: number;
  temperature?: number;
  promptTemplate?: string;
  onProgress?: (done: number, total: number, latest?: RawIdea[]) => void;
}

/**
 * For each (text × domain) collision, generate N candidate ideas in parallel.
 */
export async function generateIdeas(opts: IdeaGenOptions): Promise<RawIdea[]> {
  const {
    client,
    brief,
    domains,
    texts,
    perCollision = 20,
    concurrency = 4,
    temperature = 0.92,
    promptTemplate = DEFAULT_PROMPT,
    onProgress,
  } = opts;

  const pairs: Array<{ domain: Domain; text: ReferenceText }> = [];
  for (const t of texts) for (const d of domains) pairs.push({ domain: d, text: t });

  const all: RawIdea[] = [];
  let done = 0;

  await pMapLimit(pairs, concurrency, async (pair) => {
    const system = promptTemplate.replace("{N}", String(perCollision));
    const user = [
      `Brief: ${brief.problem}`,
      `Good ideas: ${brief.good_idea_criteria}`,
      `Distant domain: ${pair.domain.name}`,
      `Active principle: ${pair.domain.active_principle}`,
      `Bridging question: ${pair.domain.bridging_question}`,
      `Reference text [${pair.text.id} — ${pair.text.label}]:\n${pair.text.content}`,
      `Generate exactly ${perCollision} ideas.`,
    ].join("\n\n");

    const batch: RawIdea[] = [];
    try {
      const text = await client.chat({ system, user, temperature });
      const ideas = parseJsonArray<string>(text);
      ideas.forEach((idea, i) => {
        batch.push({
          id: `${pair.text.id}-${pair.domain.id}-${String(i + 1).padStart(2, "0")}`,
          domain_id: pair.domain.id,
          text_id: pair.text.id,
          idea,
          status: "done",
        });
      });
    } catch (err) {
      batch.push({
        id: `${pair.text.id}-${pair.domain.id}-failed`,
        domain_id: pair.domain.id,
        text_id: pair.text.id,
        idea: "",
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    all.push(...batch);
    done += 1;
    onProgress?.(done, pairs.length, batch);
    return batch;
  });

  return all;
}
