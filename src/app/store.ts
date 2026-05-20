import { create } from "zustand";
import type {
  BrainstormSummary,
  BriefValidated,
  CuratedIdea,
  Domain,
  InputBank,
  PipelineStage,
  ProjectConfig,
  RawIdea,
} from "../shared/types";

export type View =
  | "key" | "projects" | "setup" | "brainstorm"
  | "curation" | "report" | "settings" | "prompts" | "history";

export interface StrategyPlanState {
  fresh: number;
  deepen: { domainId: string }[];
  refresh: { fromIdeaId: string }[];
  feedback: { loved: number; liked: number; trashed: number };
}

// Weights for continuous progress calculation: domains 10%, ideas 60%, scoring 20%, curation 10%
const STAGE_WEIGHT: Record<PipelineStage, number> = {
  idle: 0, domains: 0, ideas: 10, scoring: 70, curation: 90, done: 100, error: 0,
};

interface State {
  view: View;
  rootDir?: string;
  currentProject?: string;
  brief?: BriefValidated;
  bank?: InputBank;
  config?: ProjectConfig;

  // pipeline state
  stage: PipelineStage;
  stageMessage: string;
  stageDone?: number;
  stageTotal?: number;
  overallPct: number;       // 0–100 for the full pipeline progress bar
  domains: Domain[];
  liveIdeas: RawIdea[];
  curated: CuratedIdea[];
  brainstormId?: number;
  iter?: number;
  reportMd?: string;
  runError?: string;
  strategyPlan?: StrategyPlanState;
  history: BrainstormSummary[];

  setView: (v: View) => void;
  setProject: (name: string, rootDir?: string, brief?: BriefValidated, bank?: InputBank, config?: ProjectConfig) => void;
  applyEvent: (e: {
    stage: PipelineStage;
    message: string;
    done?: number;
    total?: number;
    payload?: unknown;
    brainstormId?: number;
    iter?: number;
  }) => void;
  setReport: (md: string) => void;
  setCurated: (curated: CuratedIdea[]) => void;
  setStrategyPlan: (plan: StrategyPlanState) => void;
  setHistory: (h: BrainstormSummary[]) => void;
  setRunError: (err?: string) => void;
  reset: () => void;
}

export const useStore = create<State>((set) => ({
  view: "key",
  stage: "idle",
  stageMessage: "",
  overallPct: 0,
  domains: [],
  liveIdeas: [],
  curated: [],
  history: [],

  setView: (v) => set({ view: v }),

  setProject: (name, rootDir, brief, bank, config) =>
    set({ currentProject: name, rootDir, brief, bank, config }),

  applyEvent: (e) =>
    set((s) => {
      const next: Partial<State> = {
        stage: e.stage,
        stageMessage: e.message,
      };
      if (typeof e.done === "number") next.stageDone = e.done;
      if (typeof e.total === "number") next.stageTotal = e.total;
      if (e.brainstormId) next.brainstormId = e.brainstormId;
      if (e.iter) next.iter = e.iter;

      // Compute continuous overall progress
      const base = STAGE_WEIGHT[e.stage] ?? 0;
      if (e.stage === "ideas" && typeof e.done === "number" && typeof e.total === "number") {
        const pct = e.total > 0 ? (e.done / e.total) * 60 : 0;
        next.overallPct = 10 + pct; // domains finished (10%), now filling 60%
      } else if (e.stage === "scoring" && typeof e.done === "number" && typeof e.total === "number") {
        const pct = e.total > 0 ? (e.done / e.total) * 20 : 0;
        next.overallPct = 70 + pct;
      } else {
        next.overallPct = base;
      }

      if (e.stage === "domains" && Array.isArray(e.payload)) {
        next.domains = e.payload as Domain[];
        next.overallPct = 10;
      }
      if (e.stage === "ideas" && Array.isArray(e.payload)) {
        next.liveIdeas = [...s.liveIdeas, ...(e.payload as RawIdea[])];
      }
      if (e.stage === "done" && e.payload && typeof e.payload === "object") {
        const p = e.payload as { curated?: CuratedIdea[]; domains?: Domain[] };
        if (p.curated) next.curated = p.curated;
        if (p.domains) next.domains = p.domains;
        next.overallPct = 100;
        next.runError = undefined;
      }
      if (e.stage === "error") {
        next.runError = e.message;
      }
      return next;
    }),

  setReport: (md) => set({ reportMd: md }),
  setCurated: (curated) => set({ curated }),
  setStrategyPlan: (plan) => set({ strategyPlan: plan }),
  setHistory: (h) => set({ history: h }),
  setRunError: (err) => set({ runError: err }),

  reset: () => set({
    stage: "idle",
    stageMessage: "",
    stageDone: undefined,
    stageTotal: undefined,
    overallPct: 0,
    domains: [],
    liveIdeas: [],
    curated: [],
    reportMd: undefined,
    runError: undefined,
    strategyPlan: undefined,
  }),
}));
