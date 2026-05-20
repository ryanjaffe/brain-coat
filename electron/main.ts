import { app, BrowserWindow, ipcMain, safeStorage, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import { GrokClient } from "../src/pipeline/grokClient";
import { ProjectStore } from "../src/storage/projectStore";
import { runIteration, buildNextDomains } from "../src/pipeline/runIteration";
import { renderReport } from "../src/pipeline/report";
import { planNextIteration } from "../src/pipeline/strategies";
import { generateReferenceTexts } from "../src/pipeline/textGenerator";
import type {
  BriefValidated,
  CuratedIdea,
  InputBank,
  ProjectConfig,
} from "../src/shared/types";

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// ---- active run state ----
let activeAbort: AbortController | null = null;
let activeClient: GrokClient | null = null;

function keyFilePath() {
  return path.join(app.getPath("userData"), "xai_key.enc");
}
function loadApiKey(): string | null {
  const p = keyFilePath();
  if (!fs.existsSync(p)) return null;
  if (!safeStorage.isEncryptionAvailable()) return null;
  try { return safeStorage.decryptString(fs.readFileSync(p)); } catch { return null; }
}
function saveApiKey(key: string) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("OS keychain unavailable");
  fs.writeFileSync(keyFilePath(), safeStorage.encryptString(key));
}
function defaultProjectsDir() {
  return path.join(app.getPath("userData"), "projects");
}
function getStore(rootDir?: string) {
  const root = rootDir && fs.existsSync(rootDir) ? rootDir : defaultProjectsDir();
  fs.mkdirSync(root, { recursive: true });
  return new ProjectStore(root);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 860,
    backgroundColor: "#0b0d18",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

// ─────────────────────────── IPC ───────────────────────────

ipcMain.handle("key:has", () => loadApiKey() !== null);
ipcMain.handle("key:set", async (_e, key: string) => { saveApiKey(key); return true; });
ipcMain.handle("key:test", async () => {
  const key = loadApiKey();
  if (!key) return { ok: false, error: "No key" };
  try {
    const client = new GrokClient({ apiKey: key });
    await client.chat({ system: "ping", user: "respond with the single word: pong", temperature: 0, maxTokens: 64 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

ipcMain.handle("projects:list", (_e, rootDir?: string) => getStore(rootDir).listProjects());
ipcMain.handle("projects:dir", () => defaultProjectsDir());
ipcMain.handle("projects:pickDir", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle("projects:metadata", (_e, args: { rootDir?: string; name: string }) => {
  const store = getStore(args.rootDir);
  const config = store.readConfig(args.name);
  const brief = store.readBrief(args.name);
  const brainstormCount = store.brainstormCount(args.name);
  return {
    createdAt: config?.created_at ?? null,
    briefSnippet: brief?.problem ? brief.problem.slice(0, 120) : null,
    brainstormCount,
    textCount: store.readInputBank(args.name)?.reference_texts?.length ?? 0,
  };
});

ipcMain.handle(
  "project:create",
  (_e, args: { rootDir?: string; name: string; brief: BriefValidated; bank: InputBank; config: ProjectConfig }) => {
    const store = getStore(args.rootDir);
    store.ensureProject(args.name);
    store.writeBrief(args.name, args.brief);
    store.writeInputBank(args.name, args.bank);
    store.writeConfig(args.name, args.config);
    store.ensureDefaultPrompts(args.name);
    return store.projectDir(args.name);
  },
);

ipcMain.handle("project:load", (_e, args: { rootDir?: string; name: string }) => {
  const store = getStore(args.rootDir);
  return {
    brief: store.readBrief(args.name),
    bank: store.readInputBank(args.name),
    config: store.readConfig(args.name),
  };
});

ipcMain.handle("project:history", (_e, args: { rootDir?: string; name: string }) => {
  return getStore(args.rootDir).listBrainstorms(args.name);
});

ipcMain.handle(
  "project:loadIter",
  (_e, args: { rootDir?: string; name: string; brainstormId: number; iter: number }) => {
    const store = getStore(args.rootDir);
    return {
      domains: store.readDomains(args.name, args.brainstormId, args.iter),
      curated: store.readCurated(args.name, args.brainstormId, args.iter),
      meta: store.readIterMeta(args.name, args.brainstormId, args.iter),
    };
  },
);

// ---- brainstorm:run — handles both first run and continuation ----
ipcMain.handle(
  "brainstorm:run",
  async (
    event,
    args: {
      rootDir?: string;
      name: string;
      brainstormId?: number;   // omit for a fresh session
      iter?: number;           // omit to auto-detect (1 for fresh, prev+1 for continuation)
    },
  ) => {
    const apiKey = loadApiKey();
    if (!apiKey) throw new Error("No API key configured");
    const store = getStore(args.rootDir);
    const brief = store.readBrief(args.name);
    const bank = store.readInputBank(args.name);
    const config = store.readConfig(args.name);
    if (!brief || !bank || !config) throw new Error("Project incomplete");

    // Abort any existing run
    activeAbort?.abort();
    const abort = new AbortController();
    activeAbort = abort;

    const client = new GrokClient({ apiKey, model: config.llm_backend });
    client.abortController = abort;
    activeClient = client;

    const isContinuation = typeof args.brainstormId === "number";
    const brainstormId = isContinuation ? args.brainstormId! : store.nextBrainstormId(args.name);
    const iter = args.iter ?? (isContinuation ? detectNextIter(store, args.name, brainstormId) : 1);

    let prebuiltDomains = undefined;

    // For continuation runs: build the domain bank using the strategy
    if (isContinuation && iter > 1) {
      const prevIter = iter - 1;
      const prevDomains = store.readDomains(args.name, brainstormId, prevIter) ?? [];
      const prevCurated = store.readCurated(args.name, brainstormId, prevIter) ?? [];

      event.sender.send("brainstorm:event", {
        brainstormId, iter, stage: "domains",
        message: "Building strategy-informed domain bank…",
      });

      prebuiltDomains = await buildNextDomains({
        client, brief, bank, prevDomains, prevCurated, config,
      });
    }

    try {
      const result = await runIteration({
        store, projectName: args.name, brainstormId, iter,
        client, brief, bank, config, prebuiltDomains,
        signal: abort.signal,
        onEvent: (e) => event.sender.send("brainstorm:event", { brainstormId, iter, ...e }),
      });

      const md = renderReport({ brief, curated: result.curated, domains: result.domains, meta: result.meta });
      store.writeReport(args.name, brainstormId, md);
      return { brainstormId, iter, ...result, report: md };
    } catch (err) {
      if (abort.signal.aborted) {
        event.sender.send("brainstorm:event", { brainstormId, iter, stage: "error", message: "Run cancelled" });
        return { cancelled: true };
      }
      throw err;
    } finally {
      if (activeAbort === abort) { activeAbort = null; activeClient = null; }
    }
  },
);

ipcMain.handle("brainstorm:cancel", () => {
  activeAbort?.abort();
  return true;
});

ipcMain.handle(
  "brainstorm:plan",
  (_e, args: { rootDir?: string; name: string; brainstormId: number; iter: number }) => {
    const store = getStore(args.rootDir);
    const prevDomains = store.readDomains(args.name, args.brainstormId, args.iter) ?? [];
    const curated = store.readCurated(args.name, args.brainstormId, args.iter) ?? [];
    const config = store.readConfig(args.name);
    if (!config) throw new Error("Missing config");
    const plan = planNextIteration({ domains: prevDomains, curated, weights: config.strategy_weights });
    const loved = curated.filter((c) => c.feedback === "love").length;
    const liked = curated.filter((c) => c.feedback === "like").length;
    const trashed = curated.filter((c) => c.feedback === "trash").length;
    return { plan, feedback: { loved, liked, trashed } };
  },
);

ipcMain.handle(
  "iter:setFeedback",
  (_e, args: { rootDir?: string; name: string; brainstormId: number; iter: number; curated: CuratedIdea[] }) => {
    getStore(args.rootDir).writeCurated(args.name, args.brainstormId, args.iter, args.curated);
    return true;
  },
);

ipcMain.handle(
  "texts:generateFromBrief",
  async (event, args: { brief: BriefValidated; count?: number }) => {
    const apiKey = loadApiKey();
    if (!apiKey) throw new Error("No API key configured");
    const client = new GrokClient({ apiKey });
    return generateReferenceTexts({
      client, brief: args.brief, count: args.count ?? 5,
      onProgress: (msg) => event.sender.send("texts:progress", msg),
    });
  },
);

ipcMain.handle(
  "texts:generate",
  async (event, args: { rootDir?: string; name: string; count?: number }) => {
    const apiKey = loadApiKey();
    if (!apiKey) throw new Error("No API key configured");
    const store = getStore(args.rootDir);
    const brief = store.readBrief(args.name);
    if (!brief) throw new Error("Project brief not found");
    const config = store.readConfig(args.name);
    const client = new GrokClient({ apiKey, model: config?.llm_backend });
    return generateReferenceTexts({
      client, brief, count: args.count ?? 5,
      onProgress: (msg) => event.sender.send("texts:progress", msg),
    });
  },
);

ipcMain.handle(
  "texts:save",
  (_e, args: { rootDir?: string; name: string; texts: Array<{ label: string; description: string; content: string }> }) => {
    const store = getStore(args.rootDir);
    const existing = store.readInputBank(args.name) ?? { forbidden_topics: [], reference_texts: [] };
    const startIdx = existing.reference_texts.length + 1;
    const newTexts = args.texts.map((t, i) => ({
      id: `T${String(startIdx + i).padStart(2, "0")}`,
      ...t,
    }));
    store.writeInputBank(args.name, { ...existing, reference_texts: [...existing.reference_texts, ...newTexts] });
    return newTexts;
  },
);

ipcMain.handle(
  "texts:delete",
  (_e, args: { rootDir?: string; name: string; textId: string }) => {
    const store = getStore(args.rootDir);
    const bank = store.readInputBank(args.name);
    if (!bank) return false;
    store.writeInputBank(args.name, {
      ...bank,
      reference_texts: bank.reference_texts.filter((t) => t.id !== args.textId),
    });
    const txtPath = path.join(store.projectDir(args.name), "texts", `${args.textId}.txt`);
    if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    return true;
  },
);

ipcMain.handle("prompt:read", (_e, args: { rootDir?: string; name: string; file: "idea_generation.md" | "judge.md" }) =>
  getStore(args.rootDir).readPrompt(args.name, args.file));

ipcMain.handle(
  "prompt:write",
  (_e, args: { rootDir?: string; name: string; file: "idea_generation.md" | "judge.md"; content: string }) => {
    getStore(args.rootDir).writePrompt(args.name, args.file, args.content);
    return true;
  },
);

// ─────────────────────────── Helpers ───────────────────────────

function detectNextIter(store: ProjectStore, name: string, brainstormId: number): number {
  const bsDir = path.join(store.projectDir(name), "brainstorms", `brainstorm_${String(brainstormId).padStart(3, "0")}`);
  if (!fs.existsSync(bsDir)) return 1;
  const iters = fs.readdirSync(bsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("iter_"))
    .map((d) => parseInt(d.name.replace("iter_", ""), 10))
    .filter((n) => Number.isFinite(n));
  return iters.length ? Math.max(...iters) + 1 : 1;
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
