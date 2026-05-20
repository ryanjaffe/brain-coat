// Typed wrapper around the preload-injected window.api.
// Falls back to no-op mock when running outside Electron (browser preview).
import type { BraincoatAPI } from "../../electron/preload";

declare global {
  interface Window { api?: BraincoatAPI; }
}

const mock: BraincoatAPI = {} as unknown as BraincoatAPI;
Object.assign(mock, {
  key: {
    has: async () => false,
    set: async () => true,
    test: async () => ({ ok: false, error: "Not running in Electron" }),
  },
  projects: {
    list: async () => [],
    defaultDir: async () => "(browser preview)",
    pickDir: async () => null,
    metadata: async () => null,
  },
  project: {
    create: async () => "",
    load: async () => ({ brief: null, bank: null, config: null }),
    history: async () => [],
    loadIter: async () => ({ domains: null, curated: null, meta: null }),
  },
  brainstorm: {
    run: async () => ({}),
    cancel: async () => true,
    plan: async () => ({ plan: { fresh: 10, deepen: [], refresh: [] }, feedback: { loved: 0, liked: 0, trashed: 0 } }),
    onEvent: () => () => {},
  },
  iter: {
    setFeedback: async () => true,
  },
  texts: {
    generate: async () => [],
    generateFromBrief: async () => [],
    save: async () => [],
    delete: async () => true,
    onProgress: () => () => {},
  },
  prompt: {
    read: async () => "",
    write: async () => true,
  },
});

export const api: BraincoatAPI = (typeof window !== "undefined" && window.api) || mock;
export const isElectron = typeof window !== "undefined" && !!window.api;
