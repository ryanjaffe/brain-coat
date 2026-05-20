import type {
  BriefValidated,
  CuratedIdea,
  Domain,
  InputBank,
  IterationMeta,
  ProjectConfig,
  RawIdea,
} from "../shared/types";
import { GrokClient } from "./grokClient";
import { generateDomains, deepenDomains, refreshDomains } from "./domainGenerator";
import { generateIdeas } from "./ideaEngine";
import { scoreIdeas } from "./scorer";
import { curateIdeas } from "./curator";
import { planNextIteration } from "./strategies";
import { ProjectStore } from "../storage/projectStore";

export type PipelineEvent = {
  stage: "domains" | "ideas" | "scoring" | "curation" | "done";
  message: string;
  done?: number;
  total?: number;
  payload?: unknown;
};

export interface RunIterationArgs {
  store: ProjectStore;
  projectName: string;
  brainstormId: number;
  iter: number;
  client: GrokClient;
  brief: BriefValidated;
  bank: InputBank;
  config: ProjectConfig;
  /** Pre-built domains (used when continuing an iteration with deepen/refresh strategy). */
  prebuiltDomains?: Domain[];
  /** Curated ideas from the previous iteration (used for deepen/refresh). */
  prevCurated?: CuratedIdea[];
  signal?: AbortSignal;
  domainCount?: number;
  ideasPerCollision?: number;
  onEvent?: (e: PipelineEvent) => void;
}

/**
 * End-to-end pipeline for a single iteration.
 * Persists checkpoints after every stage so a crash loses at most one stage.
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
    prebuiltDomains,
    signal,
    domainCount = 10,
    ideasPerCollision = 20,
    onEvent,
  } = args;

  const started_at = new Date().toISOString();
  store.ensureIter(projectName, brainstormId, iter);

  // 1. Domains
  let domains: Domain[];
  if (prebuiltDomains && prebuiltDomains.length > 0) {
    domains = prebuiltDomains;
    store.writeDomains(projectName, brainstormId, iter, domains);
    onEvent?.({ stage: "domains", message: `Using ${domains.length} strategy-generated probes`, payload: domains });
  } else {
    onEvent?.({ stage: "domains", message: "Finding distant knowledge probes…" });
    domains = await generateDomains({
      client,
      brief,
      forbidden: bank.forbidden_topics,
      count: domainCount,
      temperature: config.temperatures.domain,
    });
    store.writeDomains(projectName, brainstormId, iter, domains);
    onEvent?.({ stage: "domains", message: `Found ${domains.length} probes`, payload: domains });
  }

  if (signal?.aborted) throw new Error("Aborted");

  // 2. Ideas
  const totalPairs = domains.length * bank.reference_texts.length;
  onEvent?.({ stage: "ideas", message: "Generating ideas…", done: 0, total: totalPairs });
  const ideas: RawIdea[] = await generateIdeas({
    client,
    brief,
    domains,
    texts: bank.reference_texts,
    perCollision: ideasPerCollision,
    concurrency: config.concurrency,
    temperature: config.temperatures.idea,
    signal,
    onProgress: (done, total, latest) =>
      onEvent?.({
        stage: "ideas",
        message: `${done * ideasPerCollision} / ${total * ideasPerCollision} ideas generated`,
        done,
        total,
        payload: latest,
      }),
  });
  store.writeRawIdeas(projectName, brainstormId, iter, ideas);

  if (signal?.aborted) throw new Error("Aborted");

  // 3. Scoring
  onEvent?.({ stage: "scoring", message: "Scoring ideas…", done: 0, total: ideas.length });
  const scored = await scoreIdeas({
    client,
    brief,
    ideas,
    temperature: config.temperatures.score,
    signal,
    onProgress: (done, total) =>
      onEvent?.({ stage: "scoring", message: `Scored ${done} / ${total}`, done, total }),
  });
  store.writeScored(projectName, brainstormId, iter, scored);

  if (signal?.aborted) throw new Error("Aborted");

  // 4. Curation
  onEvent?.({ stage: "curation", message: "Selecting the best ideas…" });
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
  onEvent?.({ stage: "done", message: "Run complete", payload: { curated, meta, domains } });
  return { domains, ideas, scored, curated, meta };
}

/** Build the domain bank for the next iteration using the strategy plan. */
export async function buildNextDomains(args: {
  client: GrokClient;
  brief: BriefValidated;
  bank: InputBank;
  prevDomains: Domain[];
  prevCurated: CuratedIdea[];
  config: ProjectConfig;
  totalDomains?: number;
}): Promise<Domain[]> {
  const { client, brief, bank, prevDomains, prevCurated, config, totalDomains = 10 } = args;

  const plan = planNextIteration({
    domains: prevDomains,
    curated: prevCurated,
    weights: config.strategy_weights,
    totalDomains,
  });

  const domainById = new Map(prevDomains.map((d) => [d.id, d]));
  const lovedDomains = plan.deepen.map((d) => domainById.get(d.domainId)).filter(Boolean) as Domain[];
  const topIdeas = prevCurated
    .filter((c) => c.feedback === "love" || c.feedback === "like")
    .sort((a, b) => b.composite - a.composite)
    .slice(0, 8);

  const [freshDomains, deepened, refreshed] = await Promise.all([
    plan.fresh > 0
      ? generateDomains({
          client,
          brief,
          forbidden: bank.forbidden_topics,
          count: plan.fresh,
          origin: "fresh",
        })
      : Promise.resolve([]),
    lovedDomains.length > 0
      ? deepenDomains({ client, brief, parentDomains: lovedDomains, countPerParent: 1 })
      : Promise.resolve([]),
    topIdeas.length >= 3
      ? refreshDomains({ client, brief, topIdeas, count: plan.refresh.length || 2 })
      : Promise.resolve([]),
  ]);

  const all = [...freshDomains, ...deepened, ...refreshed];
  return all.map((d, i) => ({ ...d, id: `D${String(i + 1).padStart(2, "0")}` }));
}
