export interface ScoringAxis {
  name: string;
  weight: number;
  description?: string;
}

export interface ReferenceText {
  id: string; // T01, T02, ...
  label: string;
  description?: string;
  content: string;
}

export interface BriefValidated {
  problem: string;
  good_idea_criteria: string;
  scoring_axes: ScoringAxis[];
}

export interface InputBank {
  forbidden_topics: string[];
  reference_texts: ReferenceText[];
}

export interface StrategyWeights {
  fresh: number;
  deepen: number;
  refresh: number;
}

export interface ProjectConfig {
  name: string;
  llm_backend: "grok-4-3";
  concurrency: number;
  temperatures: {
    domain: number;
    idea: number;
    score: number;
    curate: number;
  };
  strategy_weights: StrategyWeights;
  created_at: string;
}

export interface Domain {
  id: string;
  name: string;
  active_principle: string;
  bridging_question: string;
  origin: "fresh" | "deepen" | "refresh";
  parent_domain_id?: string;
}

export interface RawIdea {
  id: string;
  domain_id: string;
  text_id: string;
  idea: string;
  status: "done" | "failed";
  error?: string;
}

export interface ScoredIdea extends RawIdea {
  scores: Record<string, number>;
  composite: number;
}

export interface CuratedIdea extends ScoredIdea {
  curated_reason?: string;
  feedback?: "love" | "like" | "trash";
}

export interface IterationMeta {
  iteration: number;
  model: string;
  started_at: string;
  finished_at?: string;
  call_count: number;
  approx_prompt_tokens: number;
  approx_completion_tokens: number;
}

export type PipelineStage =
  | "idle"
  | "domains"
  | "ideas"
  | "scoring"
  | "curation"
  | "done";

export interface PipelineEvent {
  stage: PipelineStage;
  message: string;
  done?: number;
  total?: number;
  payload?: unknown;
}
