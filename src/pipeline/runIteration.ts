import type { BriefValidated, InputBank, IterationMeta, ProjectConfig, RawIdea } from "@shared/types";
import { GrokClient } from "./grokClient";
import { generateDomains } from "./domainGenerator";
import { generateIdeas } from "./ideaEngine";
import { scoreIdeas } from "./scorer";
import { curateIdeas } from "./curator";
import { ProjectStore } from "../storage/projectStore";

export interface RunIterationArgs {
  store: ProjectStore;
  projectName: string;
  brainstormId: number;
  iter: number;
  client: GrokClient;
  brief: BriefValidated;
  bank: InputBank;
  config: ProjectConfig;
  domainCount?: number;
  ideasPerCollision?: number;
  onEvent?: (e: {
    stage: "domains" | "ideas" | "scoring" | "curation" | "done";
    message: string;
    done?: number;
    total?: number;
    payload?: unknown;
  }) => void;
}

/**
 * End-to-end pipeline for a single iteration. Persists checkpoints after
 * every stage so a mid-run crash loses at most one stage.
 */
export async function runIteration(args: RunIterationArgs) {
  const {
    store,
    projectName,
    brainstormId,
    iter,
    client,
    brief,
    bank,
    config,
    domainCount = 10,
    ideasPerCollision = 20,
    onEvent,
  } = args;

  const started_at = new Date().toISOString();
  store.ensureIter(projectName, brainstormId, iter);

  // 1. Domains
  onEvent?.({ stage: "domains", message: "Generating distant domains…" });
  const domains = await generateDomains({
    client,
    brief,
    forbidden: bank.forbidden_topics,
    count: domainCount,
    temperature: config.temperatures.domain,
  });
  store.writeDomains(projectName, brainstormId, iter, domains);
  onEvent?.({ stage: "domains", message: `Generated ${domains.length} domains`, payload: domains });

  // 2. Ideas
  const totalPairs = domains.length * bank.reference_texts.length;
  onEvent?.({ stage: "ideas", message: "Colliding…", done: 0, total: totalPairs });
  const ideas: RawIdea[] = await generateIdeas({
    client,
    brief,
    domains,
    texts: bank.reference_texts,
    perCollision: ideasPerCollision,
    concurrency: config.concurrency,
    temperature: config.temperatures.idea,
    onProgress: (done, total, latest) =>
      onEvent?.({ stage: "ideas", message: `Generating ideas: ${done * ideasPerCollision} / ${total * ideasPerCollision}`, done, total, payload: latest }),
  });
  store.writeRawIdeas(projectName, brainstormId, iter, ideas);

  // 3. Scoring
  onEvent?.({ stage: "scoring", message: "Scoring ideas…", done: 0, total: ideas.length });
  const scored = await scoreIdeas({
    client,
    brief,
    ideas,
    temperature: config.temperatures.score,
    onProgress: (done, total) =>
      onEvent?.({ stage: "scoring", message: `Scoring: ${done} / ${total}`, done, total }),
  });
  store.writeScored(projectName, brainstormId, iter, scored);

  // 4. Curation
  onEvent?.({ stage: "curation", message: "Curating gems…" });
  const curated = await curateIdeas({
    client,
    brief,
    scored,
    temperature: config.temperatures.curate,
  });
  store.writeCurated(projectName, brainstormId, iter, curated);

  const meta: IterationMeta = {
    iteration: iter,
    model: client.model,
    started_at,
    finished_at: new Date().toISOString(),
    call_count: client.callCount,
    approx_prompt_tokens: client.approxPromptTokens,
    approx_completion_tokens: client.approxCompletionTokens,
  };
  store.writeIterMeta(projectName, brainstormId, iter, meta);

  onEvent?.({ stage: "done", message: "Iteration complete", payload: { curated, meta } });
  return { domains, ideas, scored, curated, meta };
}
