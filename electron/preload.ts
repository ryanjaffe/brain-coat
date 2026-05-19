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
  },
  project: {
    create: (args: unknown) => ipcRenderer.invoke("project:create", args),
    load: (args: unknown) => ipcRenderer.invoke("project:load", args),
  },
  brainstorm: {
    run: (args: unknown) => ipcRenderer.invoke("brainstorm:run", args),
    onEvent: (cb: (e: any) => void) => {
      const handler = (_: unknown, e: any) => cb(e);
      ipcRenderer.on("brainstorm:event", handler);
      return () => ipcRenderer.removeListener("brainstorm:event", handler);
    },
  },
  iter: {
    setFeedback: (args: unknown) => ipcRenderer.invoke("iter:setFeedback", args),
    planNext: (args: unknown) => ipcRenderer.invoke("iter:planNext", args),
  },
  prompt: {
    read: (args: unknown) => ipcRenderer.invoke("prompt:read", args),
    write: (args: unknown) => ipcRenderer.invoke("prompt:write", args),
  },
};

contextBridge.exposeInMainWorld("api", api);
export type BraincoatAPI = typeof api;
