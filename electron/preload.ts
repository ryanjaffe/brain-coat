import { contextBridge, ipcRenderer } from "electron";

const api = {
  key: {
    has: () => ipcRenderer.invoke("key:has") as Promise<boolean>,
    set: (key: string) => ipcRenderer.invoke("key:set", key) as Promise<boolean>,
    test: () => ipcRenderer.invoke("key:test") as Promise<{ ok: boolean; error?: string }>,
  },
  projects: {
    list: (rootDir?: string) => ipcRenderer.invoke("projects:list", rootDir) as Promise<string[]>,
    defaultDir: () => ipcRenderer.invoke("projects:dir") as Promise<string>,
    pickDir: () => ipcRenderer.invoke("projects:pickDir") as Promise<string | null>,
    metadata: (args: unknown) => ipcRenderer.invoke("projects:metadata", args),
  },
  project: {
    create: (args: unknown) => ipcRenderer.invoke("project:create", args),
    load: (args: unknown) => ipcRenderer.invoke("project:load", args),
    history: (args: unknown) => ipcRenderer.invoke("project:history", args),
    loadIter: (args: unknown) => ipcRenderer.invoke("project:loadIter", args),
  },
  brainstorm: {
    run: (args: unknown) => ipcRenderer.invoke("brainstorm:run", args),
    cancel: () => ipcRenderer.invoke("brainstorm:cancel"),
    plan: (args: unknown) => ipcRenderer.invoke("brainstorm:plan", args),
    onEvent: (cb: (e: any) => void) => {
      const handler = (_: unknown, e: any) => cb(e);
      ipcRenderer.on("brainstorm:event", handler);
      return () => ipcRenderer.removeListener("brainstorm:event", handler);
    },
  },
  iter: {
    setFeedback: (args: unknown) => ipcRenderer.invoke("iter:setFeedback", args),
  },
  texts: {
    generate: (args: unknown) => ipcRenderer.invoke("texts:generate", args),
    generateFromBrief: (args: unknown) => ipcRenderer.invoke("texts:generateFromBrief", args),
    save: (args: unknown) => ipcRenderer.invoke("texts:save", args),
    delete: (args: unknown) => ipcRenderer.invoke("texts:delete", args),
    onProgress: (cb: (msg: string) => void) => {
      const handler = (_: unknown, msg: string) => cb(msg);
      ipcRenderer.on("texts:progress", handler);
      return () => ipcRenderer.removeListener("texts:progress", handler);
    },
  },
  prompt: {
    read: (args: unknown) => ipcRenderer.invoke("prompt:read", args),
    write: (args: unknown) => ipcRenderer.invoke("prompt:write", args),
  },
};

contextBridge.exposeInMainWorld("api", api);
export type BraincoatAPI = typeof api;
