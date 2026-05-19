import { create } from "zustand";
import type {
  BriefValidated,
  CuratedIdea,
  Domain,
  InputBank,
  PipelineStage,
  ProjectConfig,
  RawIdea,
} from "../shared/types";

export type View =
  | "key"
  | "projects"
  | "setup"
  | "brainstorm"
  | "curation"
  | "report"
  | "settings"
  | "prompts";

interface State {
  view: View;
  rootDir?: string;
  currentProject?: string;
  brief?: BriefValidated;
  bank?: InputBank;
  config?: ProjectConfig;

  // pipeline state
  stage: PipelineStage;
  message: string;
  progress?: { done: number; total: number };
  domains: Domain[];
  liveIdeas: RawIdea[];
  curated: CuratedIdea[];
  brainstormId?: number;
  iter?: number;
  reportMd?: string;
  tokenCount: number;

  setView: (v: View) => void;
  setProject: (
    name: string,
    rootDir?: string,
    brief?: BriefValidated,
    bank?: InputBank,
    config?: ProjectConfig,
  ) => void;
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
  reset: () => void;
}

export const useStore = create<State>((set) => ({
  view: "key",
  stage: "idle",
  message: "",
  domains: [],
  liveIdeas: [],
  curated: [],
  tokenCount: 0,

  setView: (v) => set({ view: v }),
  setProject: (name, rootDir, brief, bank, config) =>
    set({ currentProject: name, rootDir, brief, bank, config }),

  applyEvent: (e) =>
    set((s) => {
      const next: Partial<State> = {
        stage: e.stage,
        message: e.message,
      };
      if (typeof e.done === "number" && typeof e.total === "number") {
        next.progress = { done: e.done, total: e.total };
      }
      if (e.brainstormId) next.brainstormId = e.brainstormId;
      if (e.iter) next.iter = e.iter;
      if (e.stage === "domains" && Array.isArray(e.payload)) {
        next.domains = e.payload as Domain[];
      }
      if (e.stage === "ideas" && Array.isArray(e.payload)) {
        next.liveIdeas = [...s.liveIdeas, ...(e.payload as RawIdea[])];
      }
      if (e.stage === "done" && e.payload && typeof e.payload === "object") {
        const p = e.payload as { curated?: CuratedIdea[] };
        if (p.curated) next.curated = p.curated;
      }
      return next;
    }),

  setReport: (md) => set({ reportMd: md }),
  setCurated: (curated) => set({ curated }),
  reset: () =>
    set({
      stage: "idle",
      message: "",
      progress: undefined,
      domains: [],
      liveIdeas: [],
      curated: [],
      reportMd: undefined,
    }),
}));
