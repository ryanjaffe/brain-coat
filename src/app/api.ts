// Thin typed wrapper around the preload-injected window.api.
// In dev outside Electron, falls back to mock no-ops so the UI still renders.

import type { BraincoatAPI } from "../../electron/preload";

declare global {
  interface Window {
    api?: BraincoatAPI;
  }
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
  },
  project: {
    create: async () => "",
    load: async () => ({ brief: null, bank: null, config: null }),
  },
  brainstorm: {
    run: async () => ({}),
    onEvent: () => () => {},
  },
  texts: {
    generate: async () => [],
    generateFromBrief: async () => [],
    save: async () => [],
    onProgress: () => () => {},
  },
  iter: {
    setFeedback: async () => true,
    planNext: async () => ({ fresh: 10, deepen: [], refresh: [] }),
  },
  prompt: {
    read: async () => "",
    write: async () => true,
  },
});

export const api: BraincoatAPI = (typeof window !== "undefined" && window.api) || mock;
export const isElectron = typeof window !== "undefined" && !!window.api;
